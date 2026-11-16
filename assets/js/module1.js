/* ==========================================================================
   FYPilot - module1.js (Activity 3 + Activity 6)
   Submit Proposal & Funding Request - validation, backend API storage,
   live list rendering + feedback.
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

  function pkr(n) {
    return Number(n).toLocaleString("en-PK");
  }

  function setErr(id, show, msg) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("show", show);
    el.textContent = msg;
  }

  function render(requests) {
    const list = $("#reqList");
    const count = $("#m1Count");
    const empty = $("#reqEmpty");
    if (!list) return;

    list.innerHTML = "";
    requests.forEach(function (r) {
      const item = document.createElement("div");
      item.className = "req-item";

      const head = document.createElement("div");
      head.className = "rq-head";
      const b = document.createElement("b");
      b.textContent = r.title;
      const badge = document.createElement("span");
      badge.className = "badge badge-" + (r.status === "Approved" ? "success" : r.status === "Rejected" ? "neutral" : "warning");
      badge.textContent = r.status;
      head.appendChild(b);
      head.appendChild(badge);

      const amt = document.createElement("div");
      amt.className = "rq-amt";
      amt.textContent = "PKR " + pkr(r.amount);

      const p = document.createElement("p");
      p.textContent = r.purpose;

      item.appendChild(head);
      item.appendChild(amt);
      item.appendChild(p);
      list.appendChild(item);
    });
    if (count) count.textContent = requests.length + (requests.length === 1 ? " item" : " items");
    if (empty) empty.hidden = requests.length > 0;
    if (list.parentElement) list.hidden = requests.length === 0;
  }

  /* ---- Load funding requests from backend -------------------------------- */
  async function loadFunding() {
    try {
      const res = await window.FYP.apiFetch("/funding");
      if (res.ok) {
        const data = await res.json();
        render(data.funding || []);
      }
    } catch (err) {
      console.warn("Funding load failed:", err);
    }
  }

  /* ---- Account menu + logout ------------------------------------------------ */
  function initAccount() {
    const avatar = $("#userAvatar");
    const menuName = $("#umName");
    const menuRoll = $("#umRoll");
    if (avatar) avatar.textContent = session.name.split(" ").filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
    if (menuName) menuName.textContent = session.name;
    if (menuRoll) menuRoll.textContent = session.roll + " · " + (session.role || "Student");
    const um = $("#userMenu");
    if (um) {
      Array.prototype.forEach.call(um.querySelectorAll(".danger-item"), function (item) {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          window.FYP.logout();
        });
      });
    }
  }

  /* ---- Primary task: submit with validation -------------------------------- */
  function initForm() {
    const form = $("#moduleForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const title = $("#m1Title").value.trim();
      const amount = $("#m1Amount").value.trim();
      const purpose = $("#m1Purpose").value.trim();
      $("#m1Title").value = title;
      $("#m1Purpose").value = purpose;

      const okTitle = title.length >= 3 && title.length <= 80;
      const okAmount = /^\d{4,7}$/.test(amount);
      const okPurpose = purpose.length >= 5 && purpose.length <= 300;

      setErr("#m1TitleErr", !okTitle, "Proposal title is required (3–80 characters).");
      setErr("#m1AmtErr", !okAmount, "Enter a valid amount in PKR (4–7 digits, e.g. 25000).");
      setErr("#m1PurposeErr", !okPurpose, "Describe the purpose (5–300 characters).");

      $("#m1Title").setAttribute("aria-invalid", okTitle ? "false" : "true");
      $("#m1Amount").setAttribute("aria-invalid", okAmount ? "false" : "true");
      $("#m1Purpose").setAttribute("aria-invalid", okPurpose ? "false" : "true");

      if (!(okTitle && okAmount && okPurpose)) return;

      /* Activity 6 - Send to backend instead of local array */
      const btn = $("#m1Submit");
      const originalBtnHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Submitting…';

      try {
        const res = await window.FYP.apiFetch("/funding", {
          method: "POST",
          body: JSON.stringify({
            title: title,
            amount: parseInt(amount, 10),
            purpose: purpose,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to submit request");
        }

        window.FYP.toast("success", "Request submitted",
          "PKR " + pkr(amount) + " added to My Requests (status: Pending).");
        form.reset();
        loadFunding();
      } catch (err) {
        window.FYP.toast("error", "Submission failed", err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
    });

    ["#m1Title", "#m1Amount", "#m1Purpose"].forEach(function (sel) {
      const el = $(sel);
      if (!el) return;
      el.addEventListener("input", function () {
        el.removeAttribute("aria-invalid");
        const errMap = { "#m1Title": "#m1TitleErr", "#m1Amount": "#m1AmtErr", "#m1Purpose": "#m1PurposeErr" };
        setErr(errMap[sel], false, "");
      });
    });
  }

  initAccount();
  initForm();
  loadFunding();
})();
