/* ==========================================================================
   FYPilot — dashboard.js
   Interactions: ③ dynamic milestone progress after upload ·
   ④ proposal similarity check with loading ·
   ⑤ notification bell with unread count ·
   upload enable/disable (gray→blue) · funding request · archive search
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---- Session guard (Activity 2 Part 9) --------------------------------------
     This page is protected: no session -> login; non-student roles -> own home. */
  let session = window.FYP.requireRole(["student"]);
  if (!session) return;

  const ROLE_LABELS = {
    student: "Student",
    supervisor: "Supervisor",
    panelist: "Panelist",
    coordinator: "Coordinator",
    library: "Library Staff"
  };

  function initWelcome() {
    const nameEl = $("#welcomeName");
    const rollEl = $("#welcomeRoll");
    const roleEl = $("#welcomeRole");
    const avatarEl = $("#userAvatar");
    const menuName = $("#umName");
    const menuRoll = $("#umRoll");
    if (nameEl) nameEl.textContent = session.name;
    if (rollEl) rollEl.textContent = session.roll;
    if (roleEl) {
      roleEl.textContent = ROLE_LABELS[session.role] || session.role;
      const cls =
        "role-pill role-" + (session.role === "library" ? "library" : session.role);
      roleEl.className = cls;
      roleEl.innerHTML =
        '<span class="dot" aria-hidden="true"></span>' +
        (ROLE_LABELS[session.role] || session.role);
    }
    const init = initials(session.name);
    if (avatarEl) avatarEl.textContent = init;
    if (menuName) menuName.textContent = session.name;
    if (menuRoll) menuRoll.textContent = session.roll + " · " + (ROLE_LABELS[session.role] || session.role);
  }

  function initials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  /* ---- Interaction ⑤: notification bell --------------------------------------- */
  function initNotifications() {
    const bellBtn = $("#bellBtn");
    const panel = $("#notifPanel");
    const badge = $("#notifBadge");
    const items = $$(".dropdown-item", panel);

    if (!bellBtn || !panel) return;
    bellBtn.addEventListener("click", () => {
      const willOpen = !panel.classList.contains("open");
      panel.classList.toggle("open", willOpen);
      bellBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        // clear unread badge (as specified in Activity Task 2)
        if (badge) badge.style.display = "none";
        items.forEach((it) => {
          it.classList.remove("unread");
          const dot = $(".unread-dot", it);
          if (dot) dot.remove();
        });
      }
    });
  }

  /* ---- Interaction: avatar dropdown + logout ----------------------------------- */
  function initUserMenu() {
    const menu = $("#userMenu");
    if (!menu) return;
    $$(".danger-item", menu).forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        window.FYP.logout();
      });
    });
  }
  /* ---- Interaction ③: upload deliverable + dynamic milestone update -------------- */
  function initUpload() {
    const fileInput = $("#fileInput");
    const dropzone = $("#dropzone");
    const docType = $("#docType");
    const uploadBtn = $("#uploadBtn");
    const fileName = $("#fileName");
    const fileLabel = $("#fileLabel");
    const status = $("#uploadStatus");
    const statusBar = $("#uploadBar");
    const statusText = $("#uploadText");
    const filesList = $("#filesList");

    if (!fileInput || !uploadBtn) return;

    /* Fix documented in Activity Task 7:
       previously the button always looked disabled; now it enables with gray→blue. */
    function refreshUploadButton() {
      const hasFile = fileInput.files.length > 0;
      uploadBtn.classList.toggle("enabled", hasFile);
      uploadBtn.disabled = !hasFile;
      if (!hasFile) {
        fileName.textContent = "";
        dropzone.classList.remove("has-file");
      }
    }

    fileInput.addEventListener("change", () => {
      const f = fileInput.files[0];
      if (f) {
        fileName.textContent = "✓ " + f.name + " (" + prettySize(f.size) + ")";
        dropzone.classList.add("has-file");
        fileLabel.textContent = f.name;
      }
      refreshUploadButton();
    });

    uploadBtn.addEventListener("click", () => {
      const f = fileInput.files[0];
      if (!f) return;

      uploadBtn.disabled = true;
      status.classList.add("show");
      statusBar.style.width = "0%";
      statusText.textContent = "Uploading “" + f.name + "” to the FYP repository…";
      statusText.className = "";

      let pct = 0;
      const timer = setInterval(() => {
        pct = Math.min(pct + 8 + Math.random() * 16, 100);
        statusBar.style.width = pct + "%";
        if (pct >= 100) {
          clearInterval(timer);
          finishUpload(f);
        }
      }, 140);
    });
  function finishUpload(f) {
      statusText.textContent = "✅ Upload successful! Deliverable stored in your FYP repository.";
      statusText.className = "text-success";

      const item = document.createElement("div");
      item.className = "file-item";
      item.innerHTML =
        '<span class="fic" aria-hidden="true">' + IC.file + "</span>" +
        '<span class="finfo"><b>' + FYP.esc(f.name) + "</b>" +
        "<span>" + FYP.esc(docType.value) + " · " + prettySize(f.size) + " · just now</span></span>" +
        '<span class="status-dot" title="Stored" aria-label="Stored"></span>';
      filesList.prepend(item);

      /* Dynamic milestone progress: Mid-Eval completes -> Final becomes active */
      advanceMilestone();

      FYP.toast("success", "Upload complete",
        "Your " + docType.value.toLowerCase() +
        " was stored and the milestone tracker was updated.");

      fileInput.value = "";
      dropzone.classList.remove("has-file");
      fileName.textContent = "";
      refreshUploadButton();
      setTimeout(() => status.classList.remove("show"), 4200);
    }

    /* Drag & drop support */
    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
    dropzone.addEventListener("click", () => fileInput.click());
  }

  const MILESTONES = [
    { key: "proposal", label: "Proposal" },
    { key: "mid", label: "Mid-Eval" },
    { key: "final", label: "Final Eval" },
    { key: "pledge", label: "Library Pledge" }
  ];

  function advanceMilestone() {
    const nodes = Array.prototype.slice.call($$(".step-node"));
    const stageLabel = $("#stageLabelText");
    const stageBar = $("#stageBar");
    let changed = false;

    nodes.forEach((node) => {
      if (node.classList.contains("active")) {
        node.classList.remove("active");
        node.classList.add("done");
        var dot = node.querySelector(".step-dot");
        if (dot) dot.innerHTML = IC.check;
        changed = true;
      } else if (changed && !node.classList.contains("done")) {
        node.classList.add("active");
      }
    });

    const activeIndex = nodes.findIndex((n) => n.classList.contains("active"));
    const pct =
      activeIndex >= 0
        ? Math.round(((activeIndex + 1) / nodes.length) * 100)
        : 100;
    if (stageBar) stageBar.style.width = pct + "%";
    if (stageLabel) {
      stageLabel.textContent =
        activeIndex >= 0
          ? "Current Stage: " + MILESTONES[activeIndex].label +
            " (In Progress — " + pct + "% complete)"
          : "🎉 All milestones completed — congratulations!";
    }
  }

  function prettySize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const IC = {
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    file:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
  };
/* ---- Interaction ④: proposal similarity check with loading ---------------- */
  function initSimilarity() {
    const btn = $("#simBtn");
    const result = $("#simResult");
    if (!btn || !result) return;

    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner" aria-hidden="true"></span> Analyzing against past FYPs…';
      result.classList.remove("show");

      /* Simulated 3-second AI analysis */
      setTimeout(() => {
        result.classList.add("show");
        btn.disabled = false;
        btn.innerHTML =
          '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Re-run check';
        FYP.toast("info", "Originality report ready",
          "12% similarity to past FYP archives — LOW RISK.");
      }, 3000);
    });
  }

  /* ---- Funding request ---------------------------------------------------------- */
  function initFunding() {
    const form = $("#fundForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = $("#fundAmount").value.trim();
      const purpose = $("#fundPurpose").value.trim();
      const amtOk = /^\d{4,7}$/.test(amount);
      const purOk = purpose.length >= 5;

      const err = (id, show, msg) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle("show", show);
        el.textContent = msg;
      };
      $("#fundAmount").setAttribute("aria-invalid", amtOk ? "false" : "true");
      $("#fundPurpose").setAttribute("aria-invalid", purOk ? "false" : "true");
      err("#fundAmountErr", !amtOk, "Enter a valid amount in PKR (e.g. 45000).");
      err("#fundPurposeErr", !purOk, "Describe the purpose (min 5 characters).");

      if (!amtOk || !purOk) return;

      const row = document.createElement("div");
      row.className = "fund-item";
      row.innerHTML =
        '<span class="fico" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4a2 2 0 1 0 0-4H9v8"/>  </svg></span>' +
        "<div><b>PKR " + Number(amount).toLocaleString() + "</b>" +
        "<span>" + FYP.esc(purpose) + " · submitted just now</span></div>" +
        '<span class="badge badge-warning st">Pending Supervisor</span>';
      $("#fundHistoryList").prepend(row);

      window.FYP.closeModal($("#fundModal"));
      FYP.toast("success", "Funding request submitted",
        "PKR " + Number(amount).toLocaleString() +
        " is now pending supervisor approval (prototype).");
      form.reset();
    });
  }

  /* ---- FYP archive browser (search + filter) ------------------------------------ */
  function initArchive() {
    const search = $("#archiveSearch");
    const filter = $("#archiveFilter");
    if (!search || !filter) return;

    const items = Array.prototype.slice.call($$(".archive-item"));

    function applyFilters() {
      const q = search.value.trim().toLowerCase();
      const f = filter.value;
      items.forEach((it) => {
        const hay = it.textContent.toLowerCase();
        const matchQ = !q || hay.indexOf(q) !== -1;
        const matchF = f === "all" || it.dataset.cat === f;
        it.style.display = matchQ && matchF ? "" : "none";
      });
    }
    search.addEventListener("input", FYP.debounce(applyFilters, 140));
    filter.addEventListener("change", applyFilters);
  }

  /* ---- Pending action checklist -------------------------------------------------- */
  function initPending() {
    const count = $("#pendingCount");
    const list = $("#pendingList");
    if (!list) return;

    list.addEventListener("change", () => {
      const boxes = $$('input[type="checkbox"]', list);
      const done = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => b.closest(".pending-item").classList.toggle("done", b.checked));
      if (count) count.textContent = done + " of " + boxes.length + " completed";
      if (done === boxes.length && boxes.length) {
        FYP.toast("success", "All caught up! 🎉",
          "Every pending action is complete. You're ready for the next stage.");
      }
    });
  }

  /* ---- Activity 2 Part 7: restricted functions (Access Denied) ----------------- */
  function showAccessDenied(roleName, action) {
    var banner = $("#deniedBanner");
    var text = $("#deniedText");
    if (text) text.textContent =
      "Access Denied ? “" + action + "” is restricted to " + roleName + ".";
    if (banner) {
      banner.hidden = false;
      banner.classList.remove("shake");
      void banner.offsetWidth;
      banner.classList.add("shake");
      setTimeout(function () { banner.hidden = true; }, 5000);
    }
    window.FYP.toast("error", "Access Denied",
      action + " requires " + roleName + " privileges.");
  }

  function initRestricted() {
    $$("[data-restricted]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showAccessDenied(btn.dataset.restrictedRole || "Supervisor",
          btn.dataset.restricted || "this action");
      });
    });
  }

  /* ---- Init ---------------------------------------------------------------------- */
  initWelcome();
  initNotifications();
  initUserMenu();
  initUpload();
  initSimilarity();
  initFunding();
  initArchive();
  initPending();
  initRestricted();
})();