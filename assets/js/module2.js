/* ==========================================================================
   FYPilot - module2.js (Activity 3 + Activity 6)
   FYP Archive Browser - backend API, live search + category filter,
   details view + feedback.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);

  if (!window.FYP) {
    if (document.body) document.body.classList.add("core-failed");
    return;
  }

  const session = window.FYP.requireRole();
  if (!session) return;

  const CAT = { ai: "AI & ML", web: "Web & Mobile", cs: "Cyber Security", iot: "IoT & Embedded", ds: "Data Science" };
  const SIM = { low: "Low sim", mid: "Mid sim", high: "High sim" };
  const SIM_CLS = { low: "sim-low", mid: "sim-mid", high: "sim-high" };

  let archiveData = [];

  function render() {
    const search = $("#m2Search").value.trim().toLowerCase();
    const filter = $("#m2Filter").value;
    const list = $("#m2List");
    const total = $("#m2Total");
    const empty = $("#m2Empty");
    if (!list) return;

    const matches = archiveData.filter(function (a) {
      const q = !search || a.title.toLowerCase().indexOf(search) !== -1 || a.summary.toLowerCase().indexOf(search) !== -1;
      const f = filter === "all" || a.category === filter;
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
        "<span>" + a.year + " · " + (CAT[a.category] || a.category) + " · " + window.FYP.esc(a.supervisor) + "</span></span>" +
        '<span class="sim-chip ' + SIM_CLS[a.similarity] + '">' + SIM[a.similarity] + "</span>" +
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
    if (meta) meta.textContent = a.year + " · " + (CAT[a.category] || a.category) + " · Supervisor: " + a.supervisor;
    if (body) body.textContent = a.summary;
    if (tags) tags.innerHTML = '<span class="sim-chip ' + SIM_CLS[a.similarity] + '">' + SIM[a.similarity] + "</span>";
    window.FYP.openModal($("#m2Modal"));
  }

  /* ---- Load archive from backend ------------------------------------------ */
  async function loadArchive() {
    try {
      const res = await window.FYP.apiFetch("/archive");
      if (res.ok) {
        const data = await res.json();
        archiveData = data.archive || [];
        render();
      }
    } catch (err) {
      console.warn("Archive load failed:", err);
    }
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
  loadArchive();
})();
