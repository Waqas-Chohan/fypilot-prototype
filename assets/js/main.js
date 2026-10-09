/* ==========================================================================
   FYPilot — shared utilities (main.js)
   Mobile nav · toasts · modals · dropdowns · reveal-on-scroll · helpers
   ========================================================================== */
(function () {
  "use strict";

  /* ---- DOM helpers ------------------------------------------------------ */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait || 180);
    };
  }

  /* ---- Toast system ------------------------------------------------------ */
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>'
  };

  function toast(type, title, msg) {
    let stack = $(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.innerHTML =
      (icons[type] || icons.info) +
      "<div><b>" + esc(title) + "</b>" +
      (msg ? "<p>" + esc(msg) + "</p>" : "") + "</div>";
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 3600);
    return el;
  }

  /* ---- Modal / dropdown helpers -------------------------------------------- */
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("open");
    document.body.style.overflow = "hidden";
    if (modalEl.dataset.focus) {
      const f = $(modalEl.dataset.focus);
      if (f) setTimeout(() => f.focus(), 60);
    }
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("open");
    if (!$(".modal.open")) document.body.style.overflow = "";
  }

  /* ---- Mobile navigation ---------------------------------------------------- */
  function initMobileNav() {
    const toggle = $(".nav-toggle");
    const panel = $(".mobile-nav");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.innerHTML = open
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
    });
    // close on link click
    $$("a", panel).forEach((a) =>
      a.addEventListener("click", () => {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
      })
    );
  }

  /* ---- Reveal on scroll ------------------------------------------------------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---- Footer year ------------------------------------------------------------ */
  function initYear() {
    $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  }
  /* ---- Generic binding for modals, dropdowns, buttons --------------------------- */
  function initBindings() {
    // Modal triggers: any [data-modal-open]
    $$("[data-modal-open]").forEach((btn) => {
      btn.addEventListener("click", () => openModal($("#" + btn.dataset.modalOpen)));
    });
    // Modal close: backdrop click + close buttons (inside modal or [data-modal-close])
    $$(".modal").forEach((m) => {
      const backdrop = $(".modal-backdrop", m);
      if (backdrop) backdrop.addEventListener("click", () => closeModal(m));
    });
    $$("[data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.closest(".modal");
        if (m) closeModal(m);
      });
    });
    // Dropdown toggles
    $$("[data-dropdown-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = $(btn.dataset.dropdownToggle);
        if (!target) return;
        const willOpen = !target.classList.contains("open");
        closeAllDropdowns();
        target.classList.toggle("open", willOpen);
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-dropdown-toggle]")) return;
      if (e.target.closest(".bell-wrap, .user-wrap")) return;
      if (!e.target.closest(".dropdown")) closeAllDropdowns();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllDropdowns();
        $$(".modal.open").forEach((m) => closeModal(m));
      }
    });
  }

  function closeAllDropdowns() {
    $$(".dropdown.open").forEach((d) => d.classList.remove("open"));
    $$("[data-dropdown-toggle][aria-expanded='true']").forEach((b) =>
      b.setAttribute("aria-expanded", "false")
    );
  }

  /* ---- Contact form (home page) -------------------------------------------------- */
  function initContactForm() {
    const form = $("#contactForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#contactName").value.trim();
      const email = $("#contactEmail").value.trim();
      const msg = $("#contactMsg").value.trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      const setErr = (id, show, text) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle("show", show);
        el.innerHTML = show
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>' + esc(text)
          : "";
      };

      const okName = !!name;
      const okEmail = validEmail;
      const okMsg = msg.length >= 5;

      setErr("#contactNameErr", !okName, "Please enter your name.");
      setErr("#contactEmailErr", !okEmail, "Please enter a valid email address.");
      setErr("#contactMsgErr", !okMsg, "Message should be at least 5 characters.");

      if (okName && okEmail && okMsg) {
        form.reset();
        toast("success", "Message sent!", "Thanks, " + esc(name.split(" ")[0]) + ". This is a prototype — our team will respond via email soon.");
      }
    });
  }

  /* ---- Init ----------------------------------------------------------------------- */
  function init() {
    initMobileNav();
    initReveal();
    initYear();
    initBindings();
    initContactForm();
    if (window.FYPInit) window.FYPInit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ====== Activity 2 - role-based session helpers ======
     fypilot_session is written by login.js on success.
     requireRole() guards a page: no session -> login; wrong role -> its own home. */
  function getSession() {
    try {
      const raw = sessionStorage.getItem("fypilot_session");
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  const ROLE_HOMES = {
    student: "dashboard.html",
    supervisor: "supervisor.html",
    panelist: "roles.html",
    coordinator: "roles.html",
    library: "roles.html"
  };

  function roleHome(role) { return ROLE_HOMES[role] || "login.html"; }

  function requireRole(allowedRoles) {
    const s = getSession();
    if (!s) { window.location.href = "login.html"; return null; }
    if (allowedRoles && allowedRoles.indexOf(s.role) === -1) {
      window.location.href = roleHome(s.role);
      return null;
    }
    return s;
  }

  function logout() {
    try { sessionStorage.removeItem("fypilot_session"); } catch (err) {}
    window.location.href = "login.html";
  }

  // Public API
  window.FYP = { toast, openModal, closeModal, esc, $, $$, debounce,
    getSession, roleHome, requireRole, logout };
})();