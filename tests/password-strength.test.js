/* Activity 5 - Task 5 automated tests (Node, no browser required).
   Loads the instructor-provided assets/js/password_strength_helper.js exactly
   as shipped (it is an IIFE that attaches to `window`, so we give it a
   minimal fake `window` to attach itself to, then read the function back off
   it — the function body itself is never touched, per the activity rules). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadCheckPasswordStrength() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "password_strength_helper.js"),
    "utf8"
  );
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.checkPasswordStrength;
}

function run() {
  const checkPasswordStrength = loadCheckPasswordStrength();
  assert.strictEqual(typeof checkPasswordStrength, "function",
    "password_strength_helper.js must expose window.checkPasswordStrength");

  // --- Weak: short, single character class -------------------------------
  let r = checkPasswordStrength("abc");
  assert.strictEqual(r.level, "Weak", "a 3-char all-lowercase password should be Weak");

  r = checkPasswordStrength("password");
  assert.strictEqual(r.level, "Weak", "an 8-char all-lowercase dictionary word should be Weak");

  // --- Moderate: longer, two-ish character classes -------------------------
  r = checkPasswordStrength("Password1");
  assert.strictEqual(r.level, "Moderate", "9 chars + upper/lower/number should be Moderate");

  // --- Strong: long + all four character classes ---------------------------
  r = checkPasswordStrength("Str0ng!Passw0rd#2026");
  assert.strictEqual(r.level, "Strong",
    "a long password mixing upper/lower/number/symbol should be Strong");

  // --- Edge cases --------------------------------------------------------------
  r = checkPasswordStrength("");
  assert.strictEqual(r.level, "Weak", "empty password should be Weak, not throw");

  r = checkPasswordStrength(undefined);
  assert.strictEqual(r.level, "Weak", "undefined password should be handled gracefully");

  console.log("[PASS] password-strength.test.js — 6 assertions");
}

module.exports = run;
if (require.main === module) run();
