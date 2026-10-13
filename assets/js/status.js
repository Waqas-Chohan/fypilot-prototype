/* ==========================================================================
   FYPilot - status.js (Activity 4)
   System Status & dependency map:
   ① live component health checks + automatic impact alert (monitoring)
   ② failure-impact simulator (direct + indirect dependants, graph highlight)
   ③ dependency matrix rendered from the shared model
   Deliberately independent of main.js so it still works when the core fails.
   ========================================================================== */
(function () {
  "use strict";

  var M = window.FYP_DEPS;
  if (!M) return;

  function $(sel) { return document.querySelector(sel); }
  function esc(str) {
    return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var BY_ID = {};
  M.components.forEach(function (c) { BY_ID[c.id] = c; });

  /* What the user loses when a component is unavailable (failure analysis). */
  var LOSES = {
    C1: "public information and contact form (mobile menu and form validation degrade)",
    C2: "sign-in, sign-up and password reset",
    C3: "the bot check before sign-in (the offline demo fallback keeps login usable)",
    C4: "toasts, modals, menus and safe HTML escaping on every page",
    C5: "session checks, the role guard and logout",
    C6: "student uploads, originality check, funding requests and grades",
    C7: "funding approvals, rubric grading, feedback and full contacts",
    C8: "proposal and funding-request submission",
    C9: "archive search, filter and details view"
  };

  /* Handling implemented in the prototype for each failure. */
  var HANDLING = {
    C2: "Already signed-in users keep working (their session is still stored). If the session store is blocked, login now stops with a clear FYP-SESSION-STORE message instead of a silent redirect loop.",
    C3: "Offline fallback: if Turnstile cannot load, the login card shows a notice and the demo login still works (degraded mode).",
    C4: "Fail-closed guard: protected pages stay hidden and show a safe FYP-CORE-UNAVAILABLE screen; the landing page and this status page keep working.",
    C5: "Fail-closed guard: content is revealed only after requireRole() succeeds, so a broken guard can never expose protected data.",
    MAIN: "Fail-closed guard: protected pages stay hidden and show a safe FYP-CORE-UNAVAILABLE screen; the landing page and this status page keep working."
  };

  /* ---- Impact analysis: reverse breadth-first search over the dependencies ---- */
  function impact(failed) {
    var failedSet = {};
    failed.forEach(function (id) { failedSet[id] = true; });
    var direct = [], indirect = [], seen = {};
    M.deps.forEach(function (d) {
      if (failedSet[d.to] && !failedSet[d.from] && !seen[d.from]) { seen[d.from] = true; direct.push(d.from); }
    });
    var queue = direct.slice();
    while (queue.length) {
      var x = queue.shift();
      M.deps.forEach(function (d) {
        if (d.to === x && !failedSet[d.from] && !seen[d.from]) {
          seen[d.from] = true; indirect.push(d.from); queue.push(d.from);
        }
      });
    }
    var order = function (a, b) { return M.ids.indexOf(a) - M.ids.indexOf(b); };
    direct.sort(order); indirect.sort(order);
    var ok = M.ids.filter(function (id) { return !failedSet[id] && !seen[id]; });
    return { failed: failed, direct: direct, indirect: indirect, ok: ok };
  }

  function label(id) { return id + " " + BY_ID[id].name; }

  function describe(r, key) {
    var html = "<b>Failed:</b> " + r.failed.map(function (id) { return esc(label(id)); }).join(", ");
    html += "<ul>";
    html += "<li><b>Directly affected:</b> " + (r.direct.length ? r.direct.map(function (id) { return esc(label(id)); }).join(", ") : "none") + "</li>";
    html += "<li><b>Indirectly affected:</b> " + (r.indirect.length ? r.indirect.map(function (id) { return esc(label(id)); }).join(", ") : "none") + "</li>";
    html += "<li><b>Keeps working:</b> " + (r.ok.length ? r.ok.map(function (id) { return esc(label(id)); }).join(", ") : "nothing") + "</li>";
    var lost = r.failed.concat(r.direct, r.indirect).map(function (id) { return LOSES[id]; });
    html += "<li><b>Functions disrupted or degraded:</b> " + esc(lost.join("; ")) + ".</li>";
    var h = HANDLING[key];
    if (h) html += "<li><b>Handling in this prototype:</b> " + esc(h) + "</li>";
    html += "</ul>";
    return html;
  }

  /* ---- Graph highlighting (inline Graphviz SVG with node_/edge_ ids) ---------- */
  function paintGraph(r) {
    var svg = $("#stGraph svg");
    if (!svg) return;
    var state = {};
    if (r) {
      r.failed.forEach(function (id) { state[id] = "is-failed"; });
      r.direct.forEach(function (id) { state[id] = "is-direct"; });
      r.indirect.forEach(function (id) { state[id] = "is-indirect"; });
      r.ok.forEach(function (id) { state[id] = "is-ok"; });
    }
    M.ids.forEach(function (id) {
      var g = svg.querySelector("#node_" + id);
      if (!g) return;
      g.classList.remove("is-failed", "is-direct", "is-indirect", "is-ok");
      if (state[id]) g.classList.add(state[id]);
    });
    M.deps.forEach(function (d) {
      var e = svg.querySelector("#edge_" + d.from + "_" + d.to);
      if (!e) return;
      var hot = r && state[d.from] && state[d.from] !== "is-ok" && state[d.to] && state[d.to] !== "is-ok";
      e.classList.toggle("is-hot", !!hot);
    });
  }

  function initSimulator() {
    var sel = $("#stFail");
    var out = $("#stSimResult");
    M.components.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id; o.textContent = label(c.id);
      sel.appendChild(o);
    });
    var o = document.createElement("option");
    o.value = "MAIN"; o.textContent = "main.js file fails (C4 + C5 together)";
    sel.appendChild(o);

    sel.addEventListener("change", function () {
      if (!sel.value) {
        out.textContent = "Select a component to analyse its failure.";
        paintGraph(null);
        return;
      }
      var failed = sel.value === "MAIN" ? ["C4", "C5"] : [sel.value];
      var r = impact(failed);
      out.innerHTML = describe(r, sel.value);
      paintGraph(r);
    });
  }

  /* ---- Dependency matrix ------------------------------------------------------- */
  function renderMatrix() {
    var t = $("#stMatrix");
    var head = "<thead><tr><th scope=\"col\">Row depends on →</th>" +
      M.ids.map(function (id) { return "<th scope=\"col\" title=\"" + esc(BY_ID[id].name) + "\">" + id + "</th>"; }).join("") +
      "</tr></thead>";
    var body = "<tbody>" + M.matrix.map(function (row, i) {
      return "<tr><th scope=\"row\">" + esc(label(M.ids[i])) + "</th>" + row.map(function (v, j) {
        var cls = i === j ? "diag" : (v ? "one" : "");
        return "<td class=\"" + cls + "\">" + v + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody>";
    var foot = "<tfoot><tr><th scope=\"row\">Direct dependants (column total)</th>" +
      M.ids.map(function (_, j) {
        return "<td>" + M.matrix.reduce(function (s, row) { return s + row[j]; }, 0) + "</td>";
      }).join("") + "</tr></tfoot>";
    t.innerHTML = head + body + foot;
  }

  /* ---- Health checks ------------------------------------------------------------ */
  var IS_FILE = window.location.protocol === "file:";

  function probe(url) {
    if (IS_FILE || !window.fetch) return Promise.resolve("unknown");
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    return fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { clearTimeout(timer); return res.ok ? "ok" : "down"; })
      .catch(function () { clearTimeout(timer); return "down"; });
  }

  function probeAll(urls) {
    return Promise.all(urls.map(probe)).then(function (rs) {
      if (rs.indexOf("down") !== -1) return "down";
      if (rs.indexOf("unknown") !== -1) return "unknown";
      return "ok";
    });
  }

  function storageWritable() {
    try {
      var k = "fypilot_status_probe";
      sessionStorage.setItem(k, "1");
      var ok = sessionStorage.getItem(k) === "1";
      sessionStorage.removeItem(k);
      return ok;
    } catch (err) { return false; }
  }

  function activeRole() {
    try {
      var raw = sessionStorage.getItem("fypilot_session");
      return raw ? (JSON.parse(raw).role || "unknown") : null;
    } catch (err) { return null; }
  }

  function turnstileCheck() {
    if (typeof navigator.onLine === "boolean" && !navigator.onLine) return Promise.resolve("degraded");
    return new Promise(function (resolve) {
      var done = false;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function () { if (!done) { done = true; resolve("ok"); } };
      s.onerror = function () { if (!done) { done = true; resolve("degraded"); } };
      document.head.appendChild(s);
      setTimeout(function () { if (!done) { done = true; resolve("degraded"); } }, 6000);
    });
  }

  function reach(s, what) {
    if (s === "down") return what + " NOT reachable";
    if (s === "unknown") return what + " — cannot be checked from file://";
    return what + " reachable";
  }

  var CHECKS = {
    C1: function () { return probeAll(["index.html"]).then(function (s) { return [s, reach(s, "index.html")]; }); },
    C2: function () { return probeAll(["login.html", "assets/js/login.js"]).then(function (s) { return [s, reach(s, "login page + login.js")]; }); },
    C3: function () {
      return turnstileCheck().then(function (s) {
        return [s, s === "ok" ? "Cloudflare Turnstile reachable" : "Turnstile unreachable — login runs in offline demo fallback"];
      });
    },
    C4: function () { return probeAll(["assets/js/main.js"]).then(function (s) { return [s, reach(s, "main.js (UI helpers)")]; }); },
    C5: function () {
      return probeAll(["assets/js/main.js"]).then(function (s) {
        var writable = storageWritable();
        var role = activeRole();
        if (!writable) return ["down", "sessionStorage is blocked — nobody can sign in"];
        if (s === "down") return [s, "main.js (session helpers) NOT reachable — protected pages fail closed"];
        return [s, "session store writable · " + (role ? "signed in as " + role : "no active session")];
      });
    },
    C6: function () { return probeAll(["dashboard.html", "assets/js/dashboard.js"]).then(function (s) { return [s, reach(s, "dashboard.html + dashboard.js")]; }); },
    C7: function () { return probeAll(["supervisor.html", "assets/js/supervisor.js"]).then(function (s) { return [s, reach(s, "supervisor.html + supervisor.js")]; }); },
    C8: function () { return probeAll(["module1.html", "assets/js/module1.js"]).then(function (s) { return [s, reach(s, "module1.html + module1.js")]; }); },
    C9: function () { return probeAll(["module2.html", "assets/js/module2.js"]).then(function (s) { return [s, reach(s, "module2.html + module2.js")]; }); }
  };

  var BADGE = {
    ok: ["badge-success", "Operational"],
    degraded: ["badge-warning", "Degraded"],
    down: ["badge-danger", "Unavailable"],
    unknown: ["badge-neutral", "Not checkable"],
    pending: ["badge-neutral", "Checking…"]
  };

  function rowHtml(c, status, detail) {
    var b = BADGE[status] || BADGE.unknown;
    return "<span class=\"hid\">" + c.id + "</span>" +
      "<div><b>" + esc(c.name) + "</b><small>" + esc(detail) + "</small></div>" +
      "<span class=\"badge " + b[0] + "\">" + b[1] + "</span>";
  }

  function runChecks() {
    var list = $("#stHealth");
    var stamp = $("#stChecked");
    var alertBox = $("#stAlert");
    list.innerHTML = "";
    alertBox.hidden = true;
    stamp.textContent = "Checking…";

    var rows = {};
    M.components.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "health-row";
      el.innerHTML = rowHtml(c, "pending", c.files);
      list.appendChild(el);
      rows[c.id] = el;
    });

    var results = {};
    Promise.all(M.components.map(function (c) {
      return CHECKS[c.id]().then(function (r) {
        results[c.id] = r[0];
        rows[c.id].innerHTML = rowHtml(c, r[0], r[1] + " · " + c.files);
      });
    })).then(function () {
      var counts = { ok: 0, degraded: 0, down: 0, unknown: 0 };
      M.ids.forEach(function (id) { counts[results[id]] = (counts[results[id]] || 0) + 1; });
      $("#stSummary").innerHTML =
        "<span class=\"badge badge-success\">" + counts.ok + " operational</span>" +
        "<span class=\"badge badge-warning\">" + counts.degraded + " degraded</span>" +
        "<span class=\"badge badge-danger\">" + counts.down + " unavailable</span>" +
        (counts.unknown ? "<span class=\"badge badge-neutral\">" + counts.unknown + " not checkable" + (IS_FILE ? " (opened from file:// — run a local server for full checks)" : "") + "</span>" : "");

      /* Alerting: if anything is down, show its cascading impact straight away. */
      var down = M.ids.filter(function (id) { return results[id] === "down"; });
      if (down.length) {
        var key = down.length === 1 ? down[0] : (down.indexOf("C4") !== -1 && down.indexOf("C5") !== -1 ? "MAIN" : down[0]);
        alertBox.innerHTML = "<b style=\"color:var(--danger-600)\">⚠ Alert — component failure detected.</b> " + describe(impact(down), key);
        alertBox.hidden = false;
      }
      stamp.textContent = "Checked " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    });
  }

  renderMatrix();
  initSimulator();
  runChecks();
  var btn = $("#stRecheck");
  if (btn) btn.addEventListener("click", runChecks);
})();
