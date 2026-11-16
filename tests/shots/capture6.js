/* Activity 6 - real browser screenshots of the frontend talking to the live Flask+PostgreSQL backend.
   Requires: backend on :5000, static server on :8080. */
const path = require("path"), fs = require("fs");
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const BASE = "http://localhost:8080";
const OUT = path.join(__dirname, "..", "..", "screenshots", "activity6");
fs.mkdirSync(OUT, { recursive: true });
const shot = (p, n, o) => p.screenshot({ path: path.join(OUT, n), ...(o || {}) });

async function textImage(browser, title, text, file) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await pg.setContent(`<body style="margin:0;background:#0f172a"><div style="background:#1e293b;color:#94a3b8;font:600 14px Segoe UI,Arial;padding:10px 16px">${esc(title)}</div><pre style="margin:0;padding:16px;color:#e2e8f0;font:13px/1.45 Consolas,monospace;white-space:pre-wrap">${text.split("\n").map(l => l.startsWith("PASS") ? `<span style="color:#4ade80">PASS</span>${esc(l.slice(4))}` : l.startsWith("FAIL") ? `<span style="color:#f87171">${esc(l)}</span>` : esc(l)).join("\n")}</pre></body>`);
  const h = await pg.evaluate(() => document.body.scrollHeight);
  await pg.setViewportSize({ width: 1200, height: Math.min(h, 2400) });
  await pg.screenshot({ path: path.join(OUT, file) });
  await pg.close();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", r => { if (r.url().includes(":5000/api")) calls.push(r.request().method() + " " + r.url().replace("http://localhost:5000", "") + " -> " + r.status()); });

  // Student login (real backend)
  await page.goto(BASE + "/login.html");
  await page.fill("#loginEmail", "w.saqib@student.nu.edu.pk");
  await page.fill("#loginPassword", "12345678");
  await page.selectOption("#loginRole", "student");
  await shot(page, "s1-login-form.png");
  await page.click("#loginSubmit");
  await page.waitForURL("**/dashboard.html");
  await page.waitForTimeout(1200);
  const token = await page.evaluate(() => sessionStorage.getItem("fypilot_token"));
  fs.writeFileSync(path.join(OUT, "token.txt"), token ? token.slice(0, 40) + "…(" + token.split(".").length + " parts)" : "none");
  await shot(page, "s2-student-dashboard-from-api.png");

  // Wrong password
  const p2 = await ctx.newPage();
  await p2.goto(BASE + "/login.html");
  await p2.fill("#loginEmail", "w.saqib@student.nu.edu.pk");
  await p2.fill("#loginPassword", "wrongpass1");
  await p2.selectOption("#loginRole", "student");
  await p2.click("#loginSubmit");
  await p2.waitForTimeout(1200);
  await shot(p2, "s3-login-failed-wrong-password.png");
  await p2.close();

  // Module 1 - funding: submit + retrieve
  await page.goto(BASE + "/module1.html");
  await page.waitForTimeout(800);
  await page.fill("#m1Title", "Cloud hosting and OCR API credits");
  await page.fill("#m1Amount", "25000");
  await page.fill("#m1Purpose", "Cloud hosting for the backend plus OCR API credits for the demo.");
  await shot(page, "s4-module1-form-filled.png");
  await page.click("#m1Submit");
  await page.waitForTimeout(1500);
  await shot(page, "s5-module1-submitted-and-listed.png");

  // Module 1 - server-side/client validation failure
  await page.fill("#m1Title", "ab");
  await page.fill("#m1Amount", "100");
  await page.fill("#m1Purpose", "x");
  await page.click("#m1Submit");
  await page.waitForTimeout(600);
  await shot(page, "s6-module1-validation-error.png");

  // Module 2 - archive retrieved from DB
  await page.goto(BASE + "/module2.html");
  await page.waitForTimeout(1200);
  await shot(page, "s7-module2-archive-from-db.png");
  await page.fill("#m2Search", "attendance");
  await page.waitForTimeout(900);
  await shot(page, "s8-module2-archive-search.png");

  // Dashboard stats
  await page.goto(BASE + "/dashboard.html");
  await page.waitForTimeout(1500);
  await shot(page, "s9-dashboard-after-submission.png");

  // No token -> protected API via browser context
  const unauth = await page.evaluate(async () => { const r = await fetch("http://localhost:5000/api/funding"); return r.status + " " + (await r.text()); });
  fs.writeFileSync(path.join(OUT, "unauth.txt"), unauth);

  // Supervisor login + role routing
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const sp = await ctx2.newPage();
  await sp.goto(BASE + "/login.html");
  await sp.fill("#loginEmail", "tahir@faculty.nu.edu.pk");
  await sp.fill("#loginPassword", "12345678");
  await sp.selectOption("#loginRole", "supervisor");
  await sp.click("#loginSubmit");
  await sp.waitForURL("**/supervisor.html");
  await sp.waitForTimeout(1000);
  await shot(sp, "s10-supervisor-login-role-routing.png");

  // Sign-up via backend
  const p3 = await ctx2.newPage();
  await p3.goto(BASE + "/login.html");
  await p3.click('[data-modal-open="signupModal"]');
  await p3.waitForSelector("#signupModal.open");
  await p3.fill("#suName", "Ayesha Khan");
  await p3.fill("#suRoll", "23F-3099");
  await p3.fill("#suEmail", "ayesha.khan@lhr.nu.edu.pk");
  await p3.fill("#suPassword", "Str0ng!Passw0rd#2026");
  await p3.check("#suAgree");
  await p3.click('#signupForm button[type="submit"]');
  await p3.waitForTimeout(1500);
  await shot(p3, "s11-signup-saved-in-backend.png");

  fs.writeFileSync(path.join(OUT, "network.txt"), calls.join("\n"));
  await textImage(browser, "Browser Network log - frontend to backend (/api) calls", calls.join("\n"), "s12-network-calls.png");
  await textImage(browser, "python tests/test_api.py - API test transcript", fs.readFileSync("/tmp/api_test.txt", "utf8"), "s13-api-tests.png");
  await browser.close();
  console.log("done", calls.length, "api calls");
})();
