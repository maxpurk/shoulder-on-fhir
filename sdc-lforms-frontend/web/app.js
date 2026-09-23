/* Drives LHC-Forms against whatever Questionnaires the server offers.
   No profile canonical, linkId or element path appears here: the extraction
   recipe travels inside the Questionnaire as a contained template. */
(function () {
  'use strict';
  // Served either at the site root or behind a path prefix, so every server path
  // is resolved against the document base rather than assumed to start at '/'.
  var root = function (p) { return new URL(p, document.baseURI).pathname; };
  var BASE = root('fhir/DEFAULT');
  var bundle = null, issues = null;
  var $ = function (id) { return document.getElementById(id); };

  function busy(t) { var b = $('busy'); if (t) { b.textContent = t + '…'; b.hidden = false; } else b.hidden = true; }
  function getJson(u) {
    return fetch(u, { headers: { Accept: 'application/fhir+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status + ' for ' + u); return r.json(); });
  }
  function whenReady(ms) {
    var t0 = Date.now();
    return new Promise(function (res, rej) {
      (function poll() {
        if (window.LForms && LForms.Util && typeof LForms.Util.addFormToPage === 'function'
            && LForms.FHIR && LForms.FHIR.R4) return res();
        if (Date.now() - t0 > ms) return rej(new Error('LHC-Forms did not load'));
        setTimeout(poll, 100);
      })();
    });
  }

  /* An implicit SNOMED subsumption ValueSet has tens of thousands of concepts.
     LHC-Forms bulk-loads any answerValueSet at render time and shows a red error
     banner when it cannot, so the binding is dropped and the open-choice item
     falls back to free text, which is what it degrades to anyway. */
  var FREETEXT_VALUESETS = ['http://snomed.info/sct?fhir_vs=isa/404684003'];

  /* LHC-Forms does not implement the SDC itemPopulationContext extension; it
     runs only the base FHIR `variable` extension, although both carry the same
     valueExpression. Rewriting it to two base variables does make the
     population query run (one holding the Bundle the query returns, a second
     unwrapping its first resource so the guide's own initialExpression works
     untouched) but only where the page has called setFHIRContext, because the
     query then has somewhere to run. This page is about extraction and sets no
     context, so the extension is dropped instead: left in place LHC-Forms
     ignores it, rewritten it would be executed and fail. */
  var ITEM_POPULATION_CONTEXT =
    'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemPopulationContext';
  var VARIABLE_EXT = 'http://hl7.org/fhir/StructureDefinition/variable';

  var HAS_FHIR_CONTEXT = false;

  function neutralisePopulationContext(items) {
    (items || []).forEach(function (i) {
      if (i.extension) {
        var out = [];
        i.extension.forEach(function (e) {
          if (e.url !== ITEM_POPULATION_CONTEXT) { out.push(e); return; }
          if (!HAS_FHIR_CONTEXT) return;          // drop it
          var ve = e.valueExpression || {};
          var name = ve.name || 'ctx';
          var bundleVe = JSON.parse(JSON.stringify(ve));
          bundleVe.name = name + 'Bundle';
          out.push({ url: VARIABLE_EXT, valueExpression: bundleVe });
          out.push({ url: VARIABLE_EXT, valueExpression: {
            name: name, language: 'text/fhirpath',
            expression: '%' + name + 'Bundle.entry.resource.first()' } });
        });
        i.extension = out;
      }
      neutralisePopulationContext(i.item);
    });
  }

  /* answerValueSet bindings are expanded here because the renderer is pointed at
     a storage-only server; the codes themselves still come from the server. */
  function inlineAnswers(q) {
    neutralisePopulationContext(q.item);
    var urls = [];
    (function walk(items) {
      (items || []).forEach(function (i) {
        if (i.answerValueSet && FREETEXT_VALUESETS.indexOf(i.answerValueSet) >= 0) {
          delete i.answerValueSet;
        } else if (i.answerValueSet && urls.indexOf(i.answerValueSet) < 0) {
          urls.push(i.answerValueSet);
        }
        walk(i.item);
      });
    })(q.item);
    /* A ValueSet backed by a local CodeSystem comes back from $expand with an
       empty expansion whenever the server's index has not been populated for
       that system, which is its state after every restart. The stored resource
       still carries a pre-computed expansion, so read it directly before giving
       up, the same fallback the other frontends use. */
    function codesFor(u) {
      return getJson(BASE + '/ValueSet/$expand?url=' + encodeURIComponent(u))
        .then(function (vs) { return (vs.expansion && vs.expansion.contains) || []; })
        .catch(function () { return []; })
        .then(function (c) {
          if (c.length) return c;
          return getJson(BASE + '/ValueSet?url=' + encodeURIComponent(u))
            .then(function (b) {
              var r = b.entry && b.entry[0] && b.entry[0].resource;
              if (!r) return [];
              var pre = (r.expansion && r.expansion.contains) || [];
              if (pre.length) return pre;
              var out = [];
              ((r.compose && r.compose.include) || []).forEach(function (inc) {
                (inc.concept || []).forEach(function (con) {
                  out.push({ system: inc.system, code: con.code, display: con.display });
                });
              });
              return out;
            })
            .catch(function () { return []; });
        });
    }
    return Promise.all(urls.map(function (u) {
      return codesFor(u).then(function (c) { return { u: u, c: c }; });
    })).then(function (rows) {
      var map = {}; rows.forEach(function (r) { map[r.u] = r.c; });
      (function walk(items) {
        (items || []).forEach(function (i) {
          if (i.answerValueSet && map[i.answerValueSet]) {
            if (map[i.answerValueSet].length) {
              i.answerOption = map[i.answerValueSet].map(function (c) {
                return { valueCoding: { system: c.system, code: c.code, display: c.display } };
              });
            }
            // dropped either way: a binding left in place makes LHC-Forms try to
            // reach a terminology server that this deployment does not expose,
            // and one unreachable binding fails the whole form
            delete i.answerValueSet;
          }
          walk(i.item);
        });
      })(q.item);
      return q;
    });
  }

  function loadForm(id) {
    busy('loading form'); bundle = null; issues = null;
    $('summary').textContent = ''; $('issues').innerHTML = ''; $('out').hidden = true;
    $('btnExtract').disabled = true; $('btnValidate').disabled = true; $('btnSubmit').disabled = true;
    getJson(BASE + '/Questionnaire/' + id)
      .then(inlineAnswers)
      .then(function (q) { return LForms.Util.addFormToPage(q, 'formContainer', { prepopulate: false }); })
      .then(function () { $('btnExtract').disabled = false; busy(); })
      .catch(function (e) { $('out').hidden = false; $('out').textContent = String(e); busy(); });
  }

  function extract() {
    busy('extracting'); issues = null; $('issues').innerHTML = '';
    try {
      /* extract:true runs lforms' own SDC extraction, which reads the
         templateExtractBundle extension and fills the contained template. */
      var out = LForms.Util.getFormFHIRData('QuestionnaireResponse', 'R4', 'formContainer', { extract: true });
      var arr = Array.isArray(out) ? out : [out];
      bundle = arr.filter(function (r) { return r && r.resourceType === 'Bundle'; })[0] || null;
      var qr = arr.filter(function (r) { return r && r.resourceType === 'QuestionnaireResponse'; })[0];
      if (!bundle) {
        $('summary').innerHTML = '<span class="bad">LHC-Forms returned no Bundle.</span> ' +
          'It produced: ' + arr.map(function (r) { return r && r.resourceType; }).join(', ');
        $('out').hidden = false; $('out').textContent = JSON.stringify(qr || arr, null, 1);
      } else {
        $('summary').textContent = 'Bundle type ' + bundle.type + ' with ' +
          (bundle.entry || []).length + ' entries: ' +
          (bundle.entry || []).map(function (e) { return e.resource.resourceType; }).join(', ') +
          (bundle.meta && bundle.meta.profile ? '  |  labelled ' + bundle.meta.profile[0].split('/').pop() : '  |  no meta.profile');
        $('out').hidden = false; $('out').textContent = JSON.stringify(bundle, null, 1);
        $('btnValidate').disabled = !$('profilePicker').value;
        $('btnSubmit').disabled = false;
      }
    } catch (e) {
      $('summary').innerHTML = '<span class="bad">Extraction threw.</span>';
      $('out').hidden = false; $('out').textContent = String(e && e.stack || e);
    }
    busy();
  }

  function validate() {
    if (!bundle || !$('profilePicker').value) return;
    busy('validating');
    fetch(root('validate-sidecar') + '?profile=' + encodeURIComponent($('profilePicker').value), {
      method: 'POST', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(bundle)
    }).then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 120)); }); })
      .then(function (oo) {
        issues = oo.issue || [];
        var errs = issues.filter(function (i) { return i.severity === 'error' || i.severity === 'fatal'; });
        var h = '<strong class="' + (errs.length ? 'bad' : 'ok') + '">' +
          (errs.length ? errs.length + ' error(s)' : 'Valid against the selected profile') + '</strong>';
        h += issues.slice(0, 40).map(function (i) {
          var s = (i.severity === 'error' || i.severity === 'fatal') ? 'bad' : 'warn';
          return '<div class="issue"><span class="' + s + '">' + i.severity + '</span> ' +
            ((i.diagnostics || (i.details && i.details.text) || '')) +
            ' <span class="sub">' + ((i.expression || []).join(', ')) + '</span></div>';
        }).join('');
        $('issues').innerHTML = h;
        $('btnSubmit').disabled = errs.length > 0;
        busy();
      }).catch(function (e) { $('issues').innerHTML = '<span class="bad">' + e + '</span>'; busy(); });
  }

  function submit() {
    busy('submitting');
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(bundle) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
      .then(function (x) {
        $('issues').innerHTML = '<div class="issue ' + (x.ok ? 'ok' : 'bad') + '">' +
          (x.ok ? 'Submitted.' : 'Rejected: ') + JSON.stringify(x.b).slice(0, 400) + '</div>';
        busy();
      }).catch(function (e) { $('issues').innerHTML = '<span class="bad">' + e + '</span>'; busy(); });
  }

  whenReady(20000).then(function () {
    fetch('lforms-assets/VERSION').then(function (r) { return r.text(); })
      .then(function (v) { $('lformsVer').textContent = 'LHC-Forms ' + v.trim(); }).catch(function () {});
    return Promise.all([
      getJson(BASE + '/Questionnaire?_count=50'),
      getJson(BASE + '/StructureDefinition?type=Bundle&_count=50')
    ]);
  }).then(function (res) {
    var fp = $('formPicker');
    fp.innerHTML = '<option value="">Choose a Questionnaire…</option>';
    ((res[0].entry) || []).forEach(function (e) {
      var q = e.resource; if (!q || !q.id) return;
      var o = document.createElement('option'); o.value = q.id;
      o.textContent = q.title || q.name || q.id; fp.appendChild(o);
    });
    fp.onchange = function () { if (fp.value) loadForm(fp.value); };
    var pp = $('profilePicker');
    ((res[1].entry) || []).forEach(function (e) {
      var sd = e.resource; if (!sd || !sd.url) return;
      var o = document.createElement('option'); o.value = sd.url;
      o.textContent = sd.title || sd.name || sd.url; pp.appendChild(o);
    });
    pp.onchange = function () { $('btnValidate').disabled = !(bundle && pp.value); };
    $('btnExtract').onclick = extract;
    $('btnValidate').onclick = validate;
    $('btnSubmit').onclick = submit;
  }).catch(function (e) {
    $('formPicker').innerHTML = '<option>' + e + '</option>';
  });
})();
