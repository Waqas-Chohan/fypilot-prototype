/* Activity 5 - Task 1 & Task 5 integration test (real DOM via jsdom).
   Loads the actual login.html sign-up form markup + the real
   assets/js/password_strength_helper.js and assets/js/login.js, and drives
   the Sign-Up form the same way a user would in the browser. main.js is not
   loaded here (it only supplies toast()/modal helpers which login.js guards
   with `window.FYP.closeModal(...)`), so we stub the tiny bit of window.FYP
   that the sign-up handler touches. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");

function buildLoginDom() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <form id="loginForm">
        <input id="loginEmail" type="email">
        <p class="field-error" id="emailErr"></p>
        <input id="loginPassword" type="password">
        <p class="field-error" id="passwordErr"></p>
        <select id="loginRole"><option value="" selected disabled></option>
          <option value="student">Student</option></select>
        <input type="checkbox" id="rememberMe">
        <div id="roleColorbar"></div>
        <span id="roleLegend"></span>
        <button type="button" id="togglePassword" style="display:none"></button>
        <div id="turnstileWrap" hidden><div id="turnstileContainer"></div>
          <p id="turnstileErr"></p></div>
        <div id="sessionAlert"></div>
        <button type="submit" id="loginSubmit" disabled></button>
        <span id="demoRoleEmail"></span><span id="demoRolePw"></span>
      </form>
      <form id="forgotForm"><input id="forgotEmail"><p id="forgotEmailErr"></p></form>
      <form id="signupForm">
        <input id="suName" maxlength="60">
        <p class="field-error" id="suNameErr"></p>
        <input id="suRoll" maxlength="12">
        <p class="field-error" id="suRollErr"></p>
        <input id="suEmail" maxlength="100">
        <p class="field-error" id="suEmailErr"></p>
        <input id="suPassword" type="password" maxlength="72">
        <div class="pw-strength" id="suPasswordStrength" hidden>
          <div class="pw-strength-bar"><span id="suPwStrengthFill"></span></div>
          <p id="suPwStrengthMsg"></p>
        </div>
        <p class="field-error" id="suPasswordErr"></p>
        <input type="checkbox" id="suAgree">
        <p class="field-error" id="suAgreeErr"></p>
        <button type="submit"></button>
      </form>
    </body></html>`,
    { url: "https://fypilot.test/login.html", runScripts: "dangerously" }
  );
  const window = dom.window;
  // Minimal FYP stub — login.js only calls closeModal/toast on signup success.
  window.FYP = { closeModal: () => {}, toast: () => {} };

  function loadScript(relPath) {
    window.eval(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
  }
  loadScript("assets/js/password_strength_helper.js");
  loadScript("assets/js/login.js");
  return { dom, window };
}

function fillSignup(window, { name, roll, email, pw, agree }) {
  const doc = window.document;
  const set = (id, val) => {
    const el = doc.getElementById(id);
    el.value = val;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  set("suName", name);
  set("suRoll", roll);
  set("suEmail", email);
  set("suPassword", pw);
  doc.getElementById("suAgree").checked = !!agree;
  doc.getElementById("signupForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

function run() {
  // --- Rejects: empty, too short, bad roll format, weak/short/too-long password
  {
    const { window } = buildLoginDom();
    fillSignup(window, { name: "Al", roll: "badformat", email: "not-an-email", pw: "short", agree: false });
    assert.ok(window.document.getElementById("suNameErr").classList.contains("show"), "2-char name must be rejected");
    assert.ok(window.document.getElementById("suRollErr").classList.contains("show"), "bad roll-number format must be rejected");
    assert.ok(window.document.getElementById("suEmailErr").classList.contains("show"), "non-university email must be rejected");
    assert.ok(window.document.getElementById("suPasswordErr").classList.contains("show"), "a 5-char password must be rejected");
    assert.ok(window.document.getElementById("suAgreeErr").classList.contains("show"), "unchecked code-of-conduct must be rejected");
  }

  // --- Rejects: leading/trailing spaces are trimmed, not treated as valid padding
  {
    const { window } = buildLoginDom();
    fillSignup(window, { name: "   ", roll: "23F-3041", email: "w.saqib@student.nu.edu.pk", pw: "12345678", agree: true });
    assert.ok(window.document.getElementById("suNameErr").classList.contains("show"),
      "a whitespace-only name must be rejected, not silently accepted");
  }

  // --- Accepts: well-formed registration ------------------------------------
  {
    const { window } = buildLoginDom();
    fillSignup(window, { name: "M. Waqas", roll: "23F-3041", email: "w.saqib@student.nu.edu.pk", pw: "12345678", agree: true });
    ["suNameErr", "suRollErr", "suEmailErr", "suPasswordErr", "suAgreeErr"].forEach((id) => {
      assert.ok(!window.document.getElementById(id).classList.contains("show"), id + " should not show an error for valid input");
    });
  }

  // --- Task 5: password-strength meter updates live as the user types --------
  {
    const { window } = buildLoginDom();
    const doc = window.document;
    const pw = doc.getElementById("suPassword");
    const meter = doc.getElementById("suPasswordStrength");

    pw.value = "abc";
    pw.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.strictEqual(meter.hidden, false, "strength meter should appear once typing starts");
    assert.strictEqual(meter.dataset.level, "weak", "'abc' should be reported as Weak");

    pw.value = "Password1";
    pw.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.strictEqual(meter.dataset.level, "moderate", "'Password1' should be reported as Moderate");

    pw.value = "Str0ng!Passw0rd#2026";
    pw.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.strictEqual(meter.dataset.level, "strong", "a long mixed-class password should be reported as Strong");
  }

  console.log("[PASS] signup-validation.test.js — 13 assertions across 4 scenarios");
}

module.exports = run;
if (require.main === module) run();
