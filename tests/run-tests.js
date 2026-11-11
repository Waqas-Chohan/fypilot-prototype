/* Activity 5 — runs all automated tests. Usage: node tests/run-tests.js */
const tests = [
  ["file-validation.test.js", "./file-validation.test.js"],
  ["password-strength.test.js", "./password-strength.test.js"],
  ["xss-feedback.test.js", "./xss-feedback.test.js"],
  ["signup-validation.test.js", "./signup-validation.test.js"]
];

let failed = 0;
tests.forEach(([label, mod]) => {
  try {
    require(mod)();
  } catch (err) {
    failed++;
    console.error("[FAIL] " + label + " — " + err.message);
  }
});

if (failed) {
  console.error("\n" + failed + " test file(s) failed.");
  process.exit(1);
} else {
  console.log("\nAll Activity 5 automated tests passed.");
}
