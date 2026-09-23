import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.hl7.fhir.r5.elementmodel.Manager.FhirFormat;
import org.hl7.fhir.r5.formats.JsonParser;
import org.hl7.fhir.r5.model.OperationOutcome;
import org.hl7.fhir.utilities.TimeTracker;
import org.hl7.fhir.utilities.validation.ValidationMessage;
import org.hl7.fhir.validation.ValidationEngine;
import org.hl7.fhir.validation.service.ValidationService;
import org.hl7.fhir.validation.service.model.ValidationContext;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class ValidatorServer {

    private static volatile ValidationEngine engine;
    // Bounded pool for the actual (CPU/heap-heavy) engine.validate() calls, separate
    // from the HTTP server's own dispatch executor. Kept conservative by default: the
    // shared `engine` field means concurrent validate() calls compete for the same
    // heap (observed ~77% utilized at idle with a 1.5GB cap), so raising this without
    // headroom to spare risks OOM rather than helping throughput.
    private static ExecutorService validationPool;
    private static long validateTimeoutSeconds;
    // Single-flight map: identical (body + profiles) submissions in flight share one
    // computation instead of each retry starting a new, competing engine.validate()
    // call. Without this, a slow validation plus an automatic client retry could pile
    // up multiple heavy validations fighting over the same heap at once. Entries are
    // removed only when the underlying computation itself finishes, not when any one
    // caller's wait times out — so any number of retries just join the same result.
    private static final ConcurrentHashMap<String, CompletableFuture<OperationOutcome>> inFlight =
            new ConcurrentHashMap<>();

    public static void main(String[] args) throws Exception {
        String txServer = envOr("TX_SERVER", "https://tx.fhir.org/r4");
        String txCache = envOr("TX_CACHE", "/tx-cache");
        String sv = envOr("FHIR_VERSION", "4.0.1");
        List<String> igs = resolveIgs();
        int port = Integer.parseInt(envOr("PORT", "3500"));
        int validatorThreads = Integer.parseInt(envOr("VALIDATOR_THREADS", "4"));
        validateTimeoutSeconds = Long.parseLong(envOr("VALIDATE_TIMEOUT_SECONDS", "90"));

        log("starting; tx=" + txServer + " txCache=" + txCache + " sv=" + sv + " igs=" + igs
                + " validatorThreads=" + validatorThreads + " validateTimeoutSeconds=" + validateTimeoutSeconds);

        ValidationContext ctx = new ValidationContext()
                .setSv(sv)
                .setTxServer(txServer)
                .setTxCache(txCache);
        for (String ig : igs) ctx.addIg(ig);

        ValidationService svc = new ValidationService();
        engine = svc.initializeValidator(ctx, /*definitions*/ null, new TimeTracker());
        log("engine warm; FHIR " + sv + " + IGs " + igs);

        validationPool = Executors.newFixedThreadPool(validatorThreads);

        // Backlog 128 (was OS default via 0) so a burst of connections queues at the
        // socket instead of being refused outright while all validation threads are busy.
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 128);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/health", ValidatorServer::handleHealth);
        server.createContext("/validate", ValidatorServer::handleValidate);
        server.start();
        log("listening on :" + port);
    }

    // CORS: frontends on :3000/:3001 fetch this service on :3500 (different
    // origin). Allow all origins — the service has no auth and is local-only.
    private static void addCors(HttpExchange ex) {
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        ex.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Accept");
        ex.getResponseHeaders().add("Access-Control-Max-Age", "86400");
    }

    private static void handleHealth(HttpExchange ex) throws IOException {
        addCors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        byte[] body = "{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(200, body.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(body); }
    }

    private static void handleValidate(HttpExchange ex) throws IOException {
        addCors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        if (!"POST".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(405, -1);
            ex.close();
            return;
        }
        try {
            byte[] body = readAll(ex);
            List<String> profiles = parseProfileParams(ex.getRequestURI().getQuery());
            String key = dedupKey(body, profiles);
            CompletableFuture<OperationOutcome> future = inFlight.computeIfAbsent(key, k -> {
                CompletableFuture<OperationOutcome> cf = CompletableFuture.supplyAsync(() -> {
                    try {
                        List<ValidationMessage> messages = new ArrayList<>();
                        return engine.validate(body, FhirFormat.JSON, profiles, messages);
                    } catch (Exception e) {
                        throw new CompletionException(e);
                    }
                }, validationPool);
                // Remove only when the computation itself finishes, regardless of how
                // many callers are (or aren't) still waiting on it.
                cf.whenComplete((r, t) -> inFlight.remove(k, cf));
                return cf;
            });
            OperationOutcome oo;
            try {
                oo = future.get(validateTimeoutSeconds, TimeUnit.SECONDS);
            } catch (TimeoutException te) {
                // Don't cancel: the underlying engine.validate() call has no cooperative
                // cancellation, so it just keeps running in the background — still
                // registered in `inFlight`, so a retry of the same content joins it
                // instead of starting a competing second one. Respond now so the client
                // (and Nginx, and the frontend's fail-open ValidatorUnavailableError path
                // — any non-2xx is treated as sidecar-unavailable, not a validation
                // failure) don't hang until an external timeout severs the connection
                // mid-write.
                sendError(ex, 503, "TimeoutException: validation exceeded "
                        + validateTimeoutSeconds + "s timeout");
                return;
            }
            String json = new JsonParser().composeString(oo);
            byte[] respBytes = json.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/fhir+json");
            ex.sendResponseHeaders(200, respBytes.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(respBytes); }
        } catch (Throwable t) {
            t.printStackTrace();
            sendError(ex, 500, t.getClass().getSimpleName() + ": " + String.valueOf(t.getMessage()));
        } finally {
            ex.close();
        }
    }

    // SHA-256 over the request body + profile params identifies "the same submission"
    // for single-flight dedup. Falls back to a unique (never-shared) key if SHA-256
    // is somehow unavailable — safer to skip dedup than to risk merging two different
    // bundles under a weak/colliding hash.
    private static String dedupKey(byte[] body, List<String> profiles) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(body);
            for (String p : profiles) {
                md.update((byte) 0);
                md.update(p.getBytes(StandardCharsets.UTF_8));
            }
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return "nodedup-" + System.nanoTime() + "-" + Thread.currentThread().getId();
        }
    }

    private static void sendError(HttpExchange ex, int status, String diagnostics) throws IOException {
        String err = "{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"fatal\",\"code\":\"exception\",\"diagnostics\":"
                + jsonString(diagnostics) + "}]}";
        byte[] errBytes = err.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/fhir+json");
        ex.sendResponseHeaders(status, errBytes.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(errBytes); }
    }

    private static byte[] readAll(HttpExchange ex) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ex.getRequestBody().transferTo(baos);
        return baos.toByteArray();
    }

    private static List<String> parseProfileParams(String query) {
        List<String> profiles = new ArrayList<>();
        if (query == null || query.isEmpty()) return profiles;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) continue;
            String key = pair.substring(0, eq);
            String val = pair.substring(eq + 1);
            if ("profile".equals(key) && !val.isEmpty()) {
                profiles.add(URLDecoder.decode(val, StandardCharsets.UTF_8));
            }
        }
        return profiles;
    }

    // IG resolution: IGS env (comma-separated mix of paths + registry ids like
    // "hl7.fhir.eu.base#2.0.0") is the explicit list. IG_PATH / IG_FALLBACK are
    // a convenience for the project IG: the first one that exists on disk wins.
    private static List<String> resolveIgs() {
        List<String> out = new ArrayList<>();
        String primary = envOr("IG_PATH", "/ig/output/package.tgz");
        String fallback = envOr("IG_FALLBACK", "/ig/fsh-generated/resources");
        String pick = null;
        for (String p : Arrays.asList(primary, fallback)) {
            if (p != null && new File(p).exists()) { pick = p; break; }
        }
        if (pick != null) out.add(pick);
        else log("WARN: project IG not found at " + primary + " or " + fallback);

        String extra = System.getenv("IGS");
        if (extra != null && !extra.isEmpty()) {
            for (String s : extra.split(",")) {
                String t = s.trim();
                if (!t.isEmpty()) out.add(t);
            }
        }
        return out;
    }

    private static String envOr(String key, String def) {
        String v = System.getenv(key);
        return (v == null || v.isEmpty()) ? def : v;
    }

    private static String jsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    private static void log(String msg) {
        System.out.println("[validator-service] " + msg);
    }
}
