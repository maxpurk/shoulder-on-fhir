# Thin HTTP wrapper around tools/validator_cli.jar — same engine as CI.
# See ADR-0051. Build context is the project root so we can reuse tools/validator_cli.jar.

FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /build
COPY tools/validator_cli.jar /build/validator_cli.jar
COPY validator-service/src/ValidatorServer.java /build/ValidatorServer.java
RUN javac -cp /build/validator_cli.jar /build/ValidatorServer.java

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/validator_cli.jar /app/validator_cli.jar
COPY --from=build /build/ValidatorServer.class /app/ValidatorServer.class

ENV PORT=3500 \
    TX_SERVER=https://tx.fhir.org/r4 \
    TX_CACHE=/tx-cache \
    FHIR_VERSION=4.0.1 \
    IG_PATH=/ig/output/package.tgz \
    IG_FALLBACK=/ig/fsh-generated/resources \
    IGS=hl7.fhir.eu.base#2.0.0,hl7.fhir.uv.xver-r5.r4#0.1.0 \
    JAVA_OPTS="-Xmx1500m -XX:+UseG1GC" \
    VALIDATOR_THREADS=4 \
    VALIDATE_TIMEOUT_SECONDS=90

EXPOSE 3500
HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=60s \
    CMD curl -fs http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "exec java $JAVA_OPTS -cp /app:/app/validator_cli.jar ValidatorServer"]
