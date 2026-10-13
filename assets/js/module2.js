/* ==========================================================================
   FYPilot - module2.js (Activity 3)
   FYP Archive Browser - sample JS array, live search + category filter,
   details view + feedback.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);

  if (!window.FYP) {
    /* Activity 4 - core library (main.js) unavailable: fail closed. The page stays
       hidden and the safe error screen is shown instead of crashing. */
    if (document.body) document.body.classList.add("core-failed");
    return;
  }

  /* Any signed-in user may use the modules; no session -> login. */
  const session = window.FYP.requireRole();
  if (!session) return;

  /* ---- Sample data (JS array - resets on refresh) ------------------------- */
  const archive = [
    { id: 1, title: "Deep-Rehab: CNN-Based Physiotherapy Coach", year: 2025, cat: "ai", sup: "Dr. Tahir", sim: "low", sum: "A web app that uses a CNN to guide patients through prescribed physiotherapy exercises and tracks range-of-motion progress." },
    { id: 2, title: "CampusRide: Ride-Sharing for FAST NUCES", year: 2025, cat: "web", sup: "Dr. Ahmed", sim: "mid", sum: "A ride-matching platform for students and staff with route suggestions and safety check-ins." },
    { id: 3, title: "PhishGuard: Real-Time Phishing URL Detection", year: 2024, cat: "cs", sup: "Dr. Malik", sim: "low", sum: "A browser extension and REST classifier that scores URLs for phishing risk before the user clicks." },
    { id: 4, title: "AgriSense: IoT Crop-Health Monitoring", year: 2024, cat: "iot", sup: "Dr. Raza", sim: "low", sum: "IoT sensor nodes report soil moisture and temperature to a dashboard with alert rules for farmers." },
    { id: 5, title: "HalalEats: Local Food Discovery", year: 2023, cat: "web", sup: "Dr. Ahmed", sim: "high", sum: "A discovery and review platform that helps users find verified halal options nearby." },
    { id: 6, title: "UrbanSense: Air-Quality Analytics", year: 2023, cat: "ds", sup: "Dr. Raza", sim: "mid", sum: "Time-series forecasting of PM2.5 readings with interpretable visualisations for city dashboards." },
    { id: 7, title: "SafeLocker: FIDO2 Passwordless Auth", year: 2022, cat: "cs", sup: "Dr. Malik", sim: "low", sum: "An open-source demo of passwordless web authentication using hardware security keys." }
  ];

  const CAT = { ai: "AI & ML", web: "Web & Mobile", cs: "Cyber Security", iot: "IoT & Embedded", ds: "Data Science" };
  const SIM = { low: "Low sim", mid: "Mid sim", high: "High sim" };
  const SIM_CLS = { low: "sim-low", mid: "sim-mid", high: "sim-high" };

  function pkr() { return window.FYP.esc; }

  function render() {
    const search = $("#m2Search").value.trim().toLowerCase();
    const filter = $("#m2Filter").value;
    const list = $("#m2List");
    const total = $("#m2Total");
    const empty = $("#m2Empty");
    if (!list) return;

    const matches = archive.filter(function (a) {
      const q = !search || a.title.toLowerCase().indexOf(search) !== -1 || a.sum.toLowerCase().indexOf(search) !== -1;
      const f = filter === "all" || a.cat === filter;
      return q && f;
    });

    list.innerHTML = "";
    matches.forEach(function (a) {
      const el = document.createElement("div");
      el.className = "arc-card";
      el.setAttribute("data-id", a.id);
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", "View details of " + a.title);
      el.innerHTML =
        '<span class="ac-ico" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>' +
        '<span class="ac-info"><b>' + window.FYP.esc(a.title) + "</b>" +
        "<span>" + a.year + " · " + (CAT[a.cat] || a.cat) + " · " + window.FYP.esc(a.sup) + "</span></span>" +
        '<span class="sim-chip ' + SIM_CLS[a.sim] + '">' + SIM[a.sim] + "</span>" +
        '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

      el.addEventListener("click", function () { openDetails(a); });
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(a); } });
      list.appendChild(el);
    });

    if (total) total.textContent = matches.length + (matches.length === 1 ? " project" : " projects") + " shown";
    if (empty) empty.hidden = matches.length > 0;
  }

  function openDetails(a) {
    const t = $("#m2ModalTitle");
    const meta = $("#m2ModalMeta");
    const body = $("#m2ModalBody");
    const tags = $("#m2ModalTags");
    if (t) t.textContent = a.title;
    if (meta) meta.textContent = a.year + " · " + (CAT[a.cat] || a.cat) + " · Supervisor: " + a.sup;
    if (body) body.textContent = a.sum;
    if (tags) tags.innerHTML = '<span class="sim-chip ' + SIM_CLS[a.sim] + '">' + SIM[a.sim] + "</span>";
    window.FYP.openModal($("#m2Modal"));
  }

  function initAccount() {
    const avatar = $("#userAvatar");
    const um = $("#userMenu");
    if (avatar) avatar.textContent = session.name.split(" ").filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
    if (um) {
      Array.prototype.forEach.call(um.querySelectorAll(".danger-item"), function (item) {
        item.addEventListener("click", function (e) { e.preventDefault(); window.FYP.logout(); });
      });
    }
  }

  function initBrowser() {
    const search = $("#m2Search");
    const filter = $("#m2Filter");
    if (!search || !filter) return;
    search.addEventListener("input", window.FYP.debounce(render, 140));
    filter.addEventListener("change", render);
  }

  initAccount();
  initBrowser();
  render();
})();
