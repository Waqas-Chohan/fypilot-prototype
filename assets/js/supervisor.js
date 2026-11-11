/* ==========================================================================
   FYPilot - supervisor.js (Activity 2)
   Role guard · funding approvals (restricted fn) · rubric grading ·
   feedback · audit log · logout
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  if (!window.FYP) {
    /* Activity 4 - core library (main.js) unavailable: fail closed. The page stays
       hidden and the safe error screen is shown instead of crashing. */
    if (document.body) document.body.classList.add("core-failed");
    return;
  }

  /* Part 9: this page is protected — Supervisor role only */
  const session = window.FYP.requireRole(["supervisor"]);
  if (!session) return;

  const ROLE_LABELS = { supervisor: "Supervisor", student: "Student" };

  function initials(name) {
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function initWelcome() {
    const nameEl = $("#welcomeName");
    const avatarEl = $("#userAvatar");
    const menuName = $("#umName");
    const menuRoll = $("#umRoll");
    if (nameEl) nameEl.textContent = session.name;
    if (avatarEl) avatarEl.textContent = initials(session.name);
    if (menuName) menuName.textContent = session.name;
    if (menuRoll) menuRoll.textContent = session.roll + " · " + (ROLE_LABELS[session.role] || session.role);
  }

  function logActivity(icon, html) {
    const list = $("#auditList");
    if (!list) return;
    const item = document.createElement("div");
    item.className = "audit-item";
    item.innerHTML =
      '<span class="aico" style="background:var(--primary-100);color:var(--primary-600)">' + icon + "</span>" +
      "<div>" + html + "</div>" +
      '<span class="atime">' + nowTime() + "</span>";
    list.prepend(item);
  }

  /* ---- Part 7: funding approval — WORKS for the Supervisor role ---------------- */
  function initFunding() {
    $$("[data-approve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = $("#" + btn.dataset.approve);
        var amt = btn.dataset.amt || "request";
        if (!row) return;
        finalize(row, "Approved", "badge-success");
        logActivity("&#128176;", "Approved funding <b>" + window.FYP.esc(amt) + "</b>");
        window.FYP.toast("success", "Request approved",
          amt + " approved — the student group has been notified (prototype).");
      });
    });
    $$("[data-reject]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = $("#" + btn.dataset.reject);
        var amt = btn.dataset.amt || "request";
        if (!row) return;
        finalize(row, "Rejected", "badge-neutral");
        logActivity("&#128176;", "Rejected funding <b>" + window.FYP.esc(amt) + "</b>");
        window.FYP.toast("info", "Request rejected",
          amt + " rejected — the group has been notified (prototype).");
      });
    });
  }

  function finalize(row, label, cls) {
    var actions = row.querySelector(".a-actions");
    if (actions) {
      actions.innerHTML = '<span class="badge ' + cls + '">' + label + "</span>";
    }
    row.classList.add("processed");
  }

  /* ---- Part 5: rubric grading with live total ----------------------------------- */
  function initGrading() {
    const sliders = $$(".rubric");
    const totalEl = $("#gradeTotal");
    const pill = $("#gradePill");
    if (!totalEl || !sliders.length) return;

    function recompute() {
      var sum = 0;
      sliders.forEach(function (s, i) {
        var sc = $("#s" + (i + 1));
        sum += parseInt(s.value, 10) || 0;
        if (sc) sc.textContent = s.value;
      });
      totalEl.textContent = sum;
      var grade = "F", cls = "grade-F";
      if (sum >= 85) { grade = "A+"; cls = "grade-A"; }
      else if (sum >= 75) { grade = "A";  cls = "grade-A"; }
      else if (sum >= 65) { grade = "B";  cls = "grade-B"; }
      else if (sum >= 50) { grade = "C";  cls = "grade-C"; }
      if (pill) { pill.className = "grade-pill " + cls; pill.textContent = grade; }
    }
    sliders.forEach(function (s) { s.addEventListener("input", recompute); });
    recompute();

    const save = $("#gradeSave");
    const exportBtn = $("#flexExport");
    if (save) {
      save.addEventListener("click", function () {
        var total = totalEl.textContent;
        var note = ($("#gradeNote") || {}).value ? "internal note recorded" : "no internal note";
        exportBtn.hidden = false;
        save.disabled = true;
        window.FYP.toast("success", "Grade saved", "FYPilot scored " + total + "/100 — the student was notified.");
        logActivity("&#128221;", "Saved grade <b>" + total + "/100</b> for FYPilot proposal (" + note + ")");
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        window.FYP.toast("info", "Flex export (preview)",
          "This sample mirrors the Flex Portal-ready export the AI-OCR pipeline will generate.");
      });
    }
  }

  /* ---- Part 5 / Activity 5 Tasks 1 & 2: feedback composer ----------------------
     Task 1 (Secure Input Validation): rejects empty/whitespace-only messages,
     enforces a 3-500 character range, trims stray spaces, and shows an inline
     error instead of only a toast.

     Task 2 (XSS Prevention): this is the component that displays user-entered
     information back in the page (the "Sent:" feedback preview list).
     BEFORE: the previous version built each entry with
       el.innerHTML = "<strong>Sent:</strong> " + FYP.esc(text);
     which concatenates a string into innerHTML — safe only as long as every
     caller remembers to escape every time. A single missed esc() call, here or
     in a future edit, would let a message like
       <img src=x onerror=alert('XSS')>
     execute as real HTML/JS in the supervisor's browser.
     AFTER: the message is written with textContent on its own text node, so
     the browser's HTML parser never runs on user-provided content at all —
     it is always displayed as inert data, regardless of what it contains. */
  const FEED_MIN = 3, FEED_MAX = 500;

  function initFeedback() {
    const msg = $("#feedMsg");
    const btn = $("#feedSend");
    const list = $("#feedList");
    if (!btn || !msg || !list) return;

    function setFeedErr(show, text) {
      const el = $("#feedMsgErr");
      if (!el) return;
      el.classList.toggle("show", show);
      el.textContent = text || "";
    }

    msg.addEventListener("input", function () { setFeedErr(false); });

    btn.addEventListener("click", function () {
      var text = msg.value.trim();
      msg.value = text; // strip leading/trailing spaces before it's "sent"

      if (text.length < FEED_MIN) {
        setFeedErr(true, "Write at least " + FEED_MIN + " characters before sending.");
        window.FYP.toast("error", "Feedback too short", "Write a short message before sending.");
        return;
      }
      if (text.length > FEED_MAX) {
        setFeedErr(true, "Feedback must be " + FEED_MAX + " characters or fewer.");
        return;
      }
      setFeedErr(false);

      // Safer rendering: build the DOM with createElement + textContent so
      // the message can never be parsed as markup (see comment above).
      var el = document.createElement("div");
      el.className = "fb-sent";
      var label = document.createElement("strong");
      label.textContent = "Sent:";
      el.appendChild(label);
      el.appendChild(document.createTextNode(" " + text));
      list.prepend(el);

      msg.value = "";
      window.FYP.toast("success", "Feedback sent", "Group F7 has been notified (prototype).");
      logActivity("&#9993;", "Sent feedback to <b>F7 · FYPilot</b>");
    });
  }

  /* ---- Bell + logout ----------------------------------------------------------- */
  function initMenus() {
    const bellBtn = $("#bellBtn");
    const panel = $("#notifPanel");
    if (bellBtn && panel) {
      bellBtn.addEventListener("click", function () {
        var willOpen = !panel.classList.contains("open");
        panel.classList.toggle("open", willOpen);
        bellBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        if (willOpen) {
          var badge = $("#notifBadge");
          if (badge) badge.style.display = "none";
          $$(".dropdown-item", panel).forEach(function (it) { it.classList.remove("unread"); });
        }
      });
    }
    const um = $("#userMenu");
    if (um) {
      $$(".danger-item", um).forEach(function (item) {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          window.FYP.logout();
        });
      });
    }
  }

  initWelcome();
  initMenus();
  initFunding();
  initGrading();
  initFeedback();
})();
