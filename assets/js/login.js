/* ==========================================================================
   FYPilot — login.js
   Interactions:  ① login form validation · ② show/hide password ·
   role colour coding · remember-me · sign-up modal ·
   simulated authentication -> dashboard (session handoff)
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* University email format — FAST-NUCES addresses (e.g. l123456@lhr.nu.edu.pk)
     are matched by the @<campus>.nu.edu.pk domain rule below. */
  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.nu\.edu\.pk$/;

  /* Activity 5 - Task 1: expected input-format rule for the roll number field
     (e.g. 23F-3041 — 2 digits, a section letter, a dash, 3-5 digits). */
  const ROLL_RE = /^\d{2}[A-Za-z]-\d{3,5}$/;
  const MAX_NAME = 60, MAX_ROLL = 12, MAX_EMAIL = 100, MIN_PW = 8, MAX_PW = 72;

  const ROLES = {
    student:     { label: "Student", cls: "role-student" },
    supervisor:  { label: "Supervisor", cls: "role-supervisor" },
    panelist:    { label: "Panelist", cls: "role-panelist" },
    coordinator: { label: "Coordinator", cls: "role-coordinator" },
    library:     { label: "Library Staff", cls: "role-library" }
  };
  const ROLE_DOMAIN = {
    student: "student.nu.edu.pk",
    supervisor: "faculty.nu.edu.pk",
    panelist: "faculty.nu.edu.pk",
    coordinator: "admin.nu.edu.pk",
    library: "library.nu.edu.pk"
  };

  /* ---- Cloudflare Turnstile (free anti-bot security check) --------------------
     1. siteKey   — create a widget at dashboard.cloudflare.com → Turnstile,
                    then paste the "Site Key" here. Empty = feature disabled
                    (the demo login keeps working offline, unchanged).
     2. verifyUrl — optional URL of the Cloudflare Worker that proxies the
                    mandatory siteverify API (see cloudflare-worker/worker.js).
                    Leave empty for a pure client-side prototype; deploy the
                    Worker for real server-side protection.
     3. allowOfflineFallback — when true, if the Turnstile script cannot load
                    (no internet / classroom Wi-Fi), login falls back to demo
                    mode with a clear notice so class demos never break.
                    ⚠️ For a real production system you would set this to
                    false and enforce validation server-side instead.          */
  const TURNSTILE = {
    siteKey: "0x4AAAAAAFKyelYyQoy3qT7z", // your Cloudflare Turnstile Site Key
    verifyUrl: "",                        // set after deploying the Worker (README)
    allowOfflineFallback: true            // keep class demos working offline
  };

  const EYE_ON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/></svg>';

  const form = $("#loginForm");
  if (!form) return;

  const emailInput = $("#loginEmail");
  const passwordInput = $("#loginPassword");
  const roleSelect = $("#loginRole");
  const submitBtn = $("#loginSubmit");
  const toggleEye = $("#togglePassword");
  const rememberBox = $("#rememberMe");
  const colorbar = $("#roleColorbar");
  const roleLegend = $("#roleLegend");

  /* ---- Helpers ------------------------------------------------------------- */
  function showError(input, errEl, msg) {
    input.setAttribute("aria-invalid", "true");
    const el = $(errEl);
    if (el) {
      el.classList.add("show");
      el.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4"/></svg>' +
        msg;
    }
  }

  function clearError(input, errEl) {
    input.removeAttribute("aria-invalid");
    const el = $(errEl);
    if (el) { el.classList.remove("show"); el.innerHTML = ""; }
  }

  /* Activity 5 - Task 1: mandatory-field + length-limit validation on the
     login form (form 2 of the "at least two forms" requirement is the
     sign-up modal above; this hardens the primary login form too). */
  const emailValid = () => {
    const v = emailInput.value.trim();
    return v !== "" && v.length <= MAX_EMAIL && EMAIL_RE.test(v);
  };
  const passwordValid = () => {
    const len = passwordInput.value.length;
    return len >= MIN_PW && len <= MAX_PW;
  };
  const roleValid = () => !!ROLES[roleSelect.value];

  /* ---- Turnstile state machine -------------------------------------------------
     mode: "off" (no key → demo mode) | "on" (widget waiting/solving) |
     "offline" (script unreachable → demo fallback) | "error" (challenge failed) */
  const turnstileState = { mode: TURNSTILE.siteKey ? "on" : "off", token: null, solved: false };

  function turnstileReady() {
    if (turnstileState.mode === "off" || turnstileState.mode === "offline") return true;
    return turnstileState.mode === "on" && turnstileState.solved && !!turnstileState.token;
  }

  function setSubmitState() {
    const ok = emailValid() && passwordValid() && roleValid() && turnstileReady();
    submitBtn.disabled = !ok;
    submitBtn.setAttribute("aria-disabled", ok ? "false" : "true");
    return ok;
  }

  function applyRole(roleKey) {
    const role = ROLES[roleKey];
    if (!role) return;
    /* colour-coded accent bar + legend pill (Student=Blue … Library=Teal) */
    colorbar.dataset.role = roleKey;
    roleLegend.className = "role-pill " + role.cls;
    roleLegend.innerHTML =
      '<span class="dot" aria-hidden="true"></span>Role: <b>' + role.label + "</b>";
    const demo = "w.saqib@" + ROLE_DOMAIN[roleKey];
    $("#demoRoleEmail").textContent = demo;
    $("#demoRolePw").textContent = "12345678";
  }

  /* ---- Interaction 1: live validation ---------------------------------------- */
  emailInput.addEventListener("input", () => {
    if (emailInput.value && !emailValid()) {
      showError(emailInput, "#emailErr",
        "Use your university email — e.g. l123456@lhr.nu.edu.pk");
    } else {
      clearError(emailInput, "#emailErr");
    }
    setSubmitState();
  });

  /* Remove stray leading/trailing spaces once the user leaves the field. */
  emailInput.addEventListener("blur", () => { emailInput.value = emailInput.value.trim(); });

  passwordInput.addEventListener("input", () => {
    if (passwordInput.value && !passwordValid()) {
      showError(passwordInput, "#passwordErr",
        "Password must be 8–" + MAX_PW + " characters.");
    } else {
      clearError(passwordInput, "#passwordErr");
    }
    if (passwordInput.value) { toggleEye.style.display = "grid"; }
    setSubmitState();
  });

  roleSelect.addEventListener("change", () => {
    applyRole(roleSelect.value);
    setSubmitState();
  });

  /* ---- Interaction 2: show / hide password ------------------------------------ */
  toggleEye.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    toggleEye.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    toggleEye.innerHTML = isHidden ? EYE_OFF : EYE_ON;
  });

  /* ---- Remember me ------------------------------------------------------------- */
  function restoreRemembered() {
    try {
      const saved = localStorage.getItem("fypilot_remember");
      if (saved) {
        emailInput.value = saved;
        rememberBox.checked = true;
        emailInput.dispatchEvent(new Event("input"));
      }
    } catch (err) { /* private mode — ignore */ }
  }

  /* ---- Initial role from query string (?role=student) ------------------------- */
  function preselectRole() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    if (r && ROLES[r]) {
      roleSelect.value = r;
      applyRole(r);
      setSubmitState();
    } else if (!roleSelect.value) {
      roleSelect.value = "student";
      applyRole("student");
      setSubmitState();
    }
  }
  /* ---- Turnstile: load script, render widget, verify token server-side --------- */
  function failTurnstile(msg) {
    turnstileState.mode = "error";
    const errEl = $("#turnstileErr");
    if (errEl) { errEl.classList.add("show"); errEl.textContent = msg; }
    setSubmitState();
  }

  /* Offline demo fallback — keeps the prototype useable in class when there is
     no internet. Shows a clear notice and lets the demo login proceed. */
  function enterOfflineMode() {
    if (turnstileState.mode !== "on") return;
    turnstileState.mode = "offline";
    const container = $("#turnstileContainer");
    if (container) {
      container.innerHTML =
        '<span class="badge badge-warning">🛜 Security check unavailable (offline)</span>';
    }
    const hint = $("#turnstileErr");
    if (hint) {
      hint.classList.add("show");
      hint.textContent = "You appear to be offline — the Turnstile security check was skipped so the demo login still works.";
    }
    setSubmitState();
  }

  function renderTurnstile() {
    const container = $("#turnstileContainer");
    if (!container || !window.turnstile) return;
    if (turnstileState.mode !== "on") return; // already fell back to offline demo
    try {
      window.turnstile.render(container, {
        sitekey: TURNSTILE.siteKey,
        theme: "light",
        callback: (token) => {
          turnstileState.token = token;
          turnstileState.solved = true;
          setSubmitState();
        },
        "error-callback": () => failTurnstile("Security check failed. Please try again."),
        "expired-callback": () => {
          turnstileState.token = null;
          turnstileState.solved = false;
          setSubmitState();
        }
      });
    } catch (err) {
      failTurnstile("Unable to initialise the security check. Please refresh.");
    }
  }

  function initTurnstile() {
    const wrap = $("#turnstileWrap");
    const container = $("#turnstileContainer");
    if (turnstileState.mode === "off" || !wrap || !container) return;
    wrap.hidden = false; // security check is part of the login form

    /* Fast path: the browser already reports "offline" → go straight to demo mode */
    if (typeof navigator.onLine === "boolean" && !navigator.onLine) {
      enterOfflineMode();
      return;
    }

    /* Reserve the widget's footprint (empty placeholder). No spinner — the
     Turnstile widget replaces it the moment it renders; the offline notice
     handles the no-internet case below. */
    container.textContent = "";
    window.CFTurnstileOnLoad = renderTurnstile;

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=CFTurnstileOnLoad&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (TURNSTILE.allowOfflineFallback) enterOfflineMode();
      else failTurnstile("The security check couldn't load. Check your internet connection and refresh.");
    };
    document.head.appendChild(script);

    const FALLBACK_MS = TURNSTILE.allowOfflineFallback ? 6000 : 8000;
    setTimeout(() => {
      if (window.turnstile) return; // widget loaded and rendered successfully
      if (TURNSTILE.allowOfflineFallback) enterOfflineMode();
      else failTurnstile("The security check took too long to load. Check your connection and refresh.");
    }, FALLBACK_MS);
  }

  async function verifyTurnstileToken() {
    if (!TURNSTILE.verifyUrl) return true; // client-only mode (documented limitation)
    try {
      const res = await fetch(TURNSTILE.verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileState.token, hostname: window.location.hostname })
      });
      const data = await res.json();
      if (data && data.success) return true;
      failTurnstile("Security verification failed. Please solve the check and try again.");
      if (window.turnstile) window.turnstile.reset($("#turnstileContainer"));
      return false;
    } catch (err) {
      failTurnstile("Security verification is temporarily unavailable. Please try again.");
      return false;
    }
  }

  /* ---- Activity 4: session-store health check (failure scenario 1) ----------------
     The session lives in sessionStorage. If the browser blocks it, login used to
     "succeed" and then silently bounce back here from the guarded dashboard.
     Now we write + read back the session first and, on failure, stop with a
     safe, informative message instead (fail-safe, no redirect loop).
     ?fault=storage simulates a blocked store for testing / class demos. */
  const SESSION_KEY = "fypilot_session";

  function saveSession(data) {
    try {
      if (/[?&]fault=storage(&|$)/.test(window.location.search)) {
        throw new Error("simulated storage failure");
      }
      const raw = JSON.stringify(data);
      sessionStorage.setItem(SESSION_KEY, raw);
      return sessionStorage.getItem(SESSION_KEY) === raw;
    } catch (err) {
      return false;
    }
  }

  const submitIdleHtml = submitBtn.innerHTML;

  function showSessionFailure() {
    const box = $("#sessionAlert");
    if (box) box.classList.add("show");
    submitBtn.innerHTML = submitIdleHtml;
    setSubmitState();
    if (window.FYP) {
      window.FYP.toast("error", "Sign-in could not be completed",
        "Your browser is blocking session storage. Allow site data and try again.");
    }
  }

  /* ---- Submit: simulate authentication & hand session to dashboard ---------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!setSubmitState()) return;
    if (turnstileState.mode === "on" && !(await verifyTurnstileToken())) return;

    const email = emailInput.value.trim();
    const roleKey = roleSelect.value;

    if (rememberBox.checked) {
      try { localStorage.setItem("fypilot_remember", email); } catch (err) {}
    } else {
      try { localStorage.removeItem("fypilot_remember"); } catch (err) {}
    }

    /* Activity 2 - demo users: every login resolves to a concrete profile. */
    const PROFILES = {
      student: { name: "M. Waqas", roll: "23F-3041" },
      supervisor: { name: "Dr. Tahir", roll: "Supervisor ? Faculty" },
      panelist: { name: "Panelist A", roll: "Panel ? Faculty" },
      coordinator: { name: "FYP Coordinator", roll: "Coordinator ? CS Dept" },
      library: { name: "Library Officer", roll: "Library Staff" }
    };
    const profile = Object.assign({ role: roleKey }, PROFILES[roleKey] || PROFILES.student);

    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="spinner" aria-hidden="true"></span> Signing in…';

    // Activity 2 Part 4: recognise the role and route to the correct interface
    const ROUTE = {
      student: "dashboard.html",
      supervisor: "supervisor.html",
      panelist: "roles.html",
      coordinator: "roles.html",
      library: "roles.html"
    }[roleKey] || "dashboard.html";

    const alertBox = $("#sessionAlert");
    if (alertBox) alertBox.classList.remove("show");

    setTimeout(() => {
      const saved = saveSession({ name: profile.name, roll: profile.roll, role: profile.role, email });
      if (!saved) { showSessionFailure(); return; }   // Activity 4: fail safe, no redirect loop
      window.location.href = ROUTE;
    }, 900);
  });

  /* ---- Forgot password (placeholder reset) ---------------------------------------- */
  const forgotForm = $("#forgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const em = $("#forgotEmail");
      const errEl = $("#forgotEmailErr");
      const anyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim());
      if (!anyEmail) {
        em.setAttribute("aria-invalid", "true");
        if (errEl) { errEl.classList.add("show"); errEl.textContent = "Enter a valid email address."; }
        return;
      }
      em.removeAttribute("aria-invalid");
      if (errEl) { errEl.classList.remove("show"); errEl.textContent = ""; }
      window.FYP.closeModal($("#forgotModal"));
      window.FYP.toast("success", "Reset link sent",
        "A password-reset link was emailed to " + em.value.trim() +
        " (prototype placeholder — backend arrives next semester).");
      forgotForm.reset();
    });
  }

  /* ---- Sign-up modal (Interaction: role-aware registration) ---------------------- */
  /* Activity 5 - Task 1: Secure Input Validation (form 1 of 2).
     Hardens the registration form against empty / too-short / too-long /
     badly-formatted / stray-whitespace input before anything is "created". */
  const signupForm = $("#signupForm");
  if (signupForm) {
    const suPw = $("#suPassword");
    const pwMeter = $("#suPasswordStrength");
    const pwFill = $("#suPwStrengthFill");
    const pwMsg = $("#suPwStrengthMsg");

    /* Task 5: live password-strength feedback using the instructor-provided
       checkPasswordStrength() from password_strength_helper.js. The function
       itself is used as-is and is never modified here. */
    function updatePasswordStrength() {
      if (!suPw || !pwMeter || typeof window.checkPasswordStrength !== "function") return;
      if (!suPw.value) { pwMeter.hidden = true; return; }
      const result = window.checkPasswordStrength(suPw.value);
      pwMeter.hidden = false;
      pwMeter.dataset.level = result.level.toLowerCase();
      if (pwFill) pwFill.style.width = Math.round((result.score / result.maximumScore) * 100) + "%";
      if (pwMsg) pwMsg.textContent = result.level + " — " + result.message;
    }
    if (suPw) suPw.addEventListener("input", updatePasswordStrength);

    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = {
        name: $("#suName"),
        roll: $("#suRoll"),
        email: $("#suEmail"),
        pw: suPw,
        agree: $("#suAgree")
      };
      const err = (id, show, msg) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle("show", show);
        el.textContent = msg;
      };

      /* Remove unnecessary leading/trailing spaces before validating or
         "storing" the value — prevents " admin " / blank-looking entries. */
      const name = f.name.value.trim();
      const roll = f.roll.value.trim();
      const email = f.email.value.trim();
      const pw = f.pw.value; // never trim a password — spaces may be intentional
      f.name.value = name;
      f.roll.value = roll;
      f.email.value = email;

      const okName = name.length >= 3 && name.length <= MAX_NAME;
      const okRoll = roll !== "" && ROLL_RE.test(roll);
      const okEmail = email !== "" && email.length <= MAX_EMAIL && EMAIL_RE.test(email);
      const okPw = pw.length >= MIN_PW && pw.length <= MAX_PW;
      const okAgree = f.agree.checked;

      f.name.setAttribute("aria-invalid", okName ? "false" : "true");
      f.roll.setAttribute("aria-invalid", okRoll ? "false" : "true");
      f.email.setAttribute("aria-invalid", okEmail ? "false" : "true");
      f.pw.setAttribute("aria-invalid", okPw ? "false" : "true");

      err("#suNameErr", !okName, name === ""
        ? "Full name is required."
        : "Full name must be 3–" + MAX_NAME + " characters.");
      err("#suRollErr", !okRoll, roll === ""
        ? "Roll number is required."
        : "Use the format 23F-3041 (2 digits, letter, dash, 3–5 digits).");
      err("#suEmailErr", !okEmail, "Use your @*.nu.edu.pk university email (max " + MAX_EMAIL + " characters).");
      err("#suPasswordErr", !okPw, "Password must be " + MIN_PW + "–" + MAX_PW + " characters.");
      err("#suAgreeErr", !okAgree, "Please accept the code of conduct.");

      if (!(okName && okRoll && okEmail && okPw && okAgree)) return;

      window.FYP.closeModal($("#signupModal"));
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input"));
      window.FYP.toast("success", "Account created (prototype)",
        "Welcome on board! Registration will be persisted once the backend is implemented.");
      signupForm.reset();
      if (pwMeter) pwMeter.hidden = true;
    });
  }

  /* ---- Activity 2 Part 3: demo accounts quick-fill ------------------------------ */
  function initDemoAccounts() {
    $$("[data-demo-account]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var acc = btn.dataset.demoAccount;
        var map = {
          student:    { email: "w.saqib@student.nu.edu.pk", pw: "12345678", role: "student" },
          supervisor: { email: "tahir@faculty.nu.edu.pk",  pw: "12345678", role: "supervisor" }
        };
        var a = map[acc];
        if (!a) return;
        emailInput.value = a.email;
        passwordInput.value = a.pw;
        roleSelect.value = a.role;
        emailInput.dispatchEvent(new Event("input"));
        passwordInput.dispatchEvent(new Event("input"));
        roleSelect.dispatchEvent(new Event("change"));
        applyRole(a.role);
        setSubmitState();
        window.FYP.toast("info", "Demo account filled",
          a.role === "supervisor"
            ? "Dr. Tahir (Supervisor) - press Login to continue."
            : "M. Waqas (Student) - press Login to continue.");
      });
    });
  }

  /* ---- Init ---------------------------------------------------------------------- */
  restoreRemembered();
  if (!emailInput.value) preselectRole();
  setSubmitState();
  initDemoAccounts();
  initTurnstile();
})();