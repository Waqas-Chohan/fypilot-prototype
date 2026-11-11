/* Activity 5 - Task 3 automated tests (Node, no browser required).
   Exercises the exact same assets/js/file-validation.js module that
   dashboard.js loads in the browser. Run with: node tests/run-tests.js */
const assert = require("assert");
const { validateFile, getExtension, prettySize } = require("../assets/js/file-validation.js");

function run(t) {
  // --- Permitted files -------------------------------------------------
  assert.strictEqual(validateFile({ name: "Proposal.pdf", size: 2 * 1024 * 1024 }).ok, true,
    "a 2MB .pdf should be accepted");
  assert.strictEqual(validateFile({ name: "Report.DOCX", size: 500 * 1024 }).ok, true,
    "extension check should be case-insensitive (.DOCX)");
  assert.strictEqual(validateFile({ name: "Slides.pptx", size: 10 * 1024 * 1024 }).ok, true,
    "a 10MB .pptx should be accepted");
  assert.strictEqual(validateFile({ name: "Archive.zip", size: 149 * 1024 * 1024 }).ok, true,
    "a file just under the 150MB limit should be accepted");

  // --- Rejected: unsupported extension -----------------------------------
  let r = validateFile({ name: "malware.exe", size: 1024 });
  assert.strictEqual(r.ok, false, "a .exe file must be rejected");
  assert.ok(/Unsupported file type/.test(r.reason), "reason should explain the extension is unsupported");

  r = validateFile({ name: "script.html", size: 1024 });
  assert.strictEqual(r.ok, false, "an .html file must be rejected");

  r = validateFile({ name: "noextension", size: 1024 });
  assert.strictEqual(r.ok, false, "a file with no extension must be rejected");

  // --- Rejected: oversized file --------------------------------------------
  r = validateFile({ name: "huge-deliverable.zip", size: 151 * 1024 * 1024 });
  assert.strictEqual(r.ok, false, "a file over the 150MB limit must be rejected");
  assert.ok(/too large/.test(r.reason), "reason should explain the file is too large");

  // --- Rejected: empty file --------------------------------------------------
  r = validateFile({ name: "empty.pdf", size: 0 });
  assert.strictEqual(r.ok, false, "a 0-byte file must be rejected");

  // --- Rejected: no file selected --------------------------------------------
  r = validateFile(null);
  assert.strictEqual(r.ok, false, "no file selected must be rejected");

  // --- Helpers ----------------------------------------------------------------
  assert.strictEqual(getExtension("Proposal_v2.1.pdf"), ".pdf");
  assert.strictEqual(getExtension("archive.tar.gz"), ".gz");
  assert.strictEqual(getExtension("noext"), "");
  assert.strictEqual(prettySize(500), "500 B");
  assert.strictEqual(prettySize(2048), "2 KB");
  assert.strictEqual(prettySize(5 * 1024 * 1024), "5.0 MB");

  console.log("[PASS] file-validation.test.js — " + 16 + " assertions");
}

module.exports = run;
if (require.main === module) run();
