/* ==========================================================================
   FYPilot - module1.js (Activity 3)
   Submit Proposal & Funding Request - validation, JS array storage,
   live list rendering + feedback.
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
  const requests = [
    { id: 1, title: "FYPilot — FYP lifecycle automation", amount: 45000, purpose: "Cloud hosting + OCR API credits", status: "Pending" }
  ];
  let nextId = 2;

  /* ---- Helpers ----------------------------------------------------------- */
  function pkr(n) {
    return Number(n).toLocaleString("en-PK");
  }

  function setErr(id, show, msg) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("show", show);
    el.textContent = msg;
  }

  function render() {
    const list = $("#reqList");
    const count = $("#m1Count");
    const empty = $("#reqEmpty");
    if (!list) return;

    list.innerHTML = "";
    requests.forEach(function (r) {
      const item = document.createElement("div");
      item.className = "req-item";
      item.innerHTML =
        '<div class="rq-head"><b>' + window.FYP.esc(r.title) + "</b>" +
        '<span class="badge badge-warning">' + r.status + "</span></div>" +
        '<div class="rq-amt">PKR ' + pkr(r.amount) + "</div>" +
        "<p>" + window.FYP.esc(r.purpose) + "</p>";
      list.appendChild(item);
    });
    if (count) count.textContent = requests.length + (requests.length === 1 ? " item" : " items");
    if (empty) empty.hidden = requests.length > 0;
    if (list.parentElement) list.hidden = requests.length === 0;
  }

  /* ---- Account menu + logout ------------------------------------------------ */
  function initAccount() {
    const avatar = $("#userAvatar");
    const menuName = $("#umName");
    const menuRoll = $("#umRoll");
    if (avatar) avatar.textContent = session.name.split(" ").filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
    if (menuName) menuName.textContent = session.name;
    if (menuRoll) menuRoll.textContent = session.roll + (session.role ? " · Student" : "");
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

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const title = $("#m1Title").value.trim();
      const amount = $("#m1Amount").value.trim();
      const purpose = $("#m1Purpose").value.trim();

      const okTitle = title.length >= 3;
      const okAmount = /^\d{4,7}$/.test(amount);
      const okPurpose = purpose.length >= 5;

      setErr("#m1TitleErr", !okTitle, "Proposal title is required (min 3 characters).");
      setErr("#m1AmtErr", !okAmount, "Enter a valid amount in PKR (4–7 digits, e.g. 25000).");
      setErr("#m1PurposeErr", !okPurpose, "Describe the purpose (min 5 characters).");

      $("#m1Title").setAttribute("aria-invalid", okTitle ? "false" : "true");
      $("#m1Amount").setAttribute("aria-invalid", okAmount ? "false" : "true");
      $("#m1Purpose").setAttribute("aria-invalid", okPurpose ? "false" : "true");

      if (!(okTitle && okAmount && okPurpose)) return;

      // store in the JS array and re-render
      requests.push({ id: nextId++, title: title, amount: parseInt(amount, 10), purpose: purpose, status: "Pending" });
      render();
      window.FYP.toast("success", "Request submitted", "PKR " + pkr(amount) + " added to My Requests (status: Pending).");
      form.reset();
    });

    // clear validation state while typing
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
  render();
})();
