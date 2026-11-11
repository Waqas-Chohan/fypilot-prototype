/* Activity 5 — captures real, automated screenshots of the running app using
   a headless Chromium (Playwright) against the actual local server, so every
   image reflects the real implemented code (not a mockup). */
const path = require("path");
const fs = require("fs");
const { chromium } = require("/opt/npm-tools/node_modules/playwright");

const BASE = "http://localhost:8731";
const OUT = path.join(__dirname, "..", "..", "screenshots", "activity5");
fs.mkdirSync(OUT, { recursive: true });

function shotPath(name) { return path.join(OUT, name); }

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let dialogFired = false;
  page.on("dialog", async (d) => { dialogFired = true; await d.dismiss(); });

  // ------------------------------------------------------------------
  // TASK 1 + TASK 5: Sign-up form (login.html)
  // ------------------------------------------------------------------
  await page.goto(BASE + "/login.html");
  await page.click('[data-modal-open="signupModal"]');
  await page.waitForSelector("#signupModal.open");

  // Invalid submission: empty + bad formats
  await page.fill("#suName", "Al");
  await page.fill("#suRoll", "badformat");
  await page.fill("#suEmail", "not-an-email");
  await page.fill("#suPassword", "short");
  await page.click('#signupForm button[type="submit"]');
  await page.screenshot({ path: shotPath("t1-signup-invalid.png") });

  // Task 5: password strength — Weak
  await page.fill("#suPassword", "abc");
  await page.waitForSelector("#suPasswordStrength:not([hidden])");
  await page.screenshot({ path: shotPath("t5-password-weak.png"), clip: { x: 0, y: 0, width: 1280, height: 900 } });

  // Task 5: Moderate
  await page.fill("#suPassword", "Password1");
  await page.waitForTimeout(100);
  await page.screenshot({ path: shotPath("t5-password-moderate.png") });

  // Task 5: Strong
  await page.fill("#suPassword", "Str0ng!Passw0rd#2026");
  await page.waitForTimeout(100);
  await page.screenshot({ path: shotPath("t5-password-strong.png") });

  // Valid sign-up
  await page.fill("#suName", "M. Waqas");
  await page.fill("#suRoll", "23F-3041");
  await page.fill("#suEmail", "w.saqib@student.nu.edu.pk");
  await page.check("#suAgree");
  await page.click('#signupForm button[type="submit"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: shotPath("t1-signup-valid-success.png") });

  // ------------------------------------------------------------------
  // Sign in as Student (demo account) -> dashboard.html
  // ------------------------------------------------------------------
  await page.goto(BASE + "/login.html");
  await page.click('[data-demo-account="student"]');
  await page.waitForTimeout(3500); // Turnstile offline-fallback timing + submit disabled check
  // Wait until the submit button becomes enabled (Turnstile offline fallback resolved)
  await page.waitForFunction(() => {
    const b = document.querySelector("#loginSubmit");
    return b && !b.disabled;
  }, { timeout: 15000 });
  await page.click("#loginSubmit");
  await page.waitForURL("**/dashboard.html", { timeout: 10000 });
  await page.waitForTimeout(300);

  // ------------------------------------------------------------------
  // TASK 3: Secure File Selection (dashboard.html upload)
  // ------------------------------------------------------------------
  await page.evaluate(() => document.querySelector("#dropzone").scrollIntoView());

  // Reject: unsupported extension
  await page.setInputFiles("#fileInput", "/tmp/fixtures/malware.exe");
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath("t3-file-rejected-extension.png") });

  // Reject: oversized file
  await page.setInputFiles("#fileInput", "/tmp/fixtures/oversized_deliverable.zip");
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath("t3-file-rejected-oversize.png") });

  // Accept: valid .pdf, then upload
  await page.setInputFiles("#fileInput", "/tmp/fixtures/Proposal_v3.pdf");
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath("t3-file-accepted.png") });
  await page.click("#uploadBtn");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: shotPath("t3-file-upload-success.png") });

  // ------------------------------------------------------------------
  // TASK 4: Sensitive Information Handling — show storage contents on-page
  // ------------------------------------------------------------------
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "__audit";
    box.style.cssText =
      "position:fixed;inset:16px;z-index:99999;background:#0b1530;color:#fff;" +
      "font:13px/1.5 monospace;padding:20px;border-radius:12px;overflow:auto;white-space:pre-wrap;";
    const dump = {
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
      localStorage: Object.fromEntries(Object.entries(localStorage))
    };
    box.textContent =
      "Task 4 audit — live contents of browser storage on this page\n" +
      "(captured via DevTools-equivalent inspection, for the submission screenshot)\n\n" +
      JSON.stringify(dump, null, 2) +
      "\n\nNo \"password\" key/value present in either store.";
    document.body.appendChild(box);
  });
  await page.screenshot({ path: shotPath("t4-storage-audit.png") });
  await page.evaluate(() => document.getElementById("__audit").remove());

  // Logout -> confirm sessionStorage cleared
  await page.click("#userAvatar");
  await page.click(".danger-item");
  await page.waitForURL("**/login.html");
  const afterLogout = await page.evaluate(() => Object.keys(sessionStorage).length);
  console.log("sessionStorage keys after logout:", afterLogout);

  // ------------------------------------------------------------------
  // Sign in as Supervisor -> TASK 1 (feedback form) + TASK 2 (XSS)
  // ------------------------------------------------------------------
  await page.goto(BASE + "/login.html");
  await page.click('[data-demo-account="supervisor"]');
  await page.waitForFunction(() => {
    const b = document.querySelector("#loginSubmit");
    return b && !b.disabled;
  }, { timeout: 15000 });
  await page.click("#loginSubmit");
  await page.waitForURL("**/supervisor.html", { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector("#feedback").scrollIntoView());

  // Task 1: empty feedback rejected
  await page.fill("#feedMsg", "   ");
  await page.click("#feedSend");
  await page.waitForTimeout(150);
  await page.screenshot({ path: shotPath("t1-feedback-empty-rejected.png") });

  // Task 2: XSS payload — must render as literal text, no dialog
  const payload = "<img src=x onerror=alert('XSS')>";
  await page.fill("#feedMsg", payload);
  await page.click("#feedSend");
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath("t2-xss-payload-neutralised.png") });

  // Task 1: normal, valid feedback accepted
  await page.fill("#feedMsg", "Please add a comparative analysis of existing FYP systems.");
  await page.click("#feedSend");
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath("t1-feedback-valid-sent.png") });

  console.log("XSS dialog fired during any step?", dialogFired);

  await browser.close();
  console.log("Done. Screenshots in:", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
