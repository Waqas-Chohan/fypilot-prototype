/* Activity 5 - Task 2 (XSS Prevention) automated test — real DOM via jsdom.
   This loads the ACTUAL assets/js/main.js + assets/js/supervisor.js files
   (unmodified, exactly as shipped to the browser) into a real DOM, drives the
   "Send Feedback" composer the same way a supervisor would in the browser,
   and asserts that instructor-style malicious payloads never become live
   <script>/<img onerror> elements in the rendered output — only inert text.

   Run with: node tests/run-tests.js
   (requires the dev-only "jsdom" package — not a runtime dependency of the
   site itself, only of this test; see tests/README.md) */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");

function buildSupervisorDom() {
  const dom = new JSDOM(
    `<!doctype html><html><body class="dash-body">
      <div id="userAvatar"></div>
      <div id="userMenu"><a href="#" class="danger-item">Logout</a></div>
      <span id="welcomeName"></span>
      <span id="umName"></span><span id="umRoll"></span>
      <div id="auditList"></div>
      <textarea id="feedMsg"></textarea>
      <button id="feedSend"></button>
      <div id="feedList"></div>
      <p id="feedMsgErr"></p>
    </body></html>`,
    { url: "https://fypilot.test/supervisor.html", runScripts: "dangerously" }
  );
  const window = dom.window;

  // A logged-in Supervisor session, exactly as login.js would have written it.
  window.sessionStorage.setItem(
    "fypilot_session",
    JSON.stringify({ name: "Dr. Tahir", roll: "Supervisor", role: "supervisor", email: "tahir@faculty.nu.edu.pk" })
  );

  // Track whether any injected payload actually executes (the real browser
  // threat model: does attacker JS run in the victim's session?).
  window.__xssFired = false;
  window.alert = () => { window.__xssFired = true; };

  function loadScript(relPath) {
    const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    window.eval(code);
  }
  loadScript("assets/js/main.js");
  loadScript("assets/js/supervisor.js");
  return { dom, window };
}

function sendFeedback(window, text) {
  const doc = window.document;
  const msg = doc.getElementById("feedMsg");
  msg.value = text;
  doc.getElementById("feedSend").dispatchEvent(new window.Event("click", { bubbles: true }));
}

function run() {
  const PAYLOADS = [
    "<script>alert('XSS')<\/script>",
    "<img src=x onerror=alert(1)>",
    "\"><svg onload=alert(1)>",
    "<a href=\"javascript:alert(1)\">click me</a>"
  ];

  PAYLOADS.forEach((payload) => {
    const { window } = buildSupervisorDom();
    sendFeedback(window, payload);

    const list = window.document.getElementById("feedList");
    const entry = list.firstElementChild;

    assert.ok(entry, "a feedback entry should have been added for payload: " + payload);
    // 1) No <script>, <img>, <svg> or <a> element was actually created in the DOM.
    assert.strictEqual(list.querySelector("script,img,svg,a"), null,
      "payload must not create a live script/img/svg/a element — got executable markup for: " + payload);
    // 2) The attacker's alert() never ran.
    assert.strictEqual(window.__xssFired, false,
      "payload must not execute as JavaScript — XSS fired for: " + payload);
    // 3) The exact text the user typed is still visible to the reader, as data.
    assert.ok(entry.textContent.indexOf(payload) !== -1,
      "the payload should still be displayed as literal text for: " + payload);
  });

  // --- Task 1 checks on the same form: empty / whitespace-only is rejected ---
  {
    const { window } = buildSupervisorDom();
    sendFeedback(window, "   ");
    const list = window.document.getElementById("feedList");
    assert.strictEqual(list.children.length, 0, "whitespace-only feedback must be rejected");
    const err = window.document.getElementById("feedMsgErr");
    assert.ok(err.classList.contains("show"), "an inline error should be shown for empty feedback");
  }

  // --- Normal, legitimate input still works correctly -------------------------
  {
    const { window } = buildSupervisorDom();
    sendFeedback(window, "Please add a comparative analysis of existing FYP systems.");
    const list = window.document.getElementById("feedList");
    assert.strictEqual(list.children.length, 1, "a normal message should be accepted");
    assert.ok(list.firstElementChild.textContent.indexOf("comparative analysis") !== -1);
  }

  console.log("[PASS] xss-feedback.test.js — " + (PAYLOADS.length * 4 + 4) + " assertions across " +
    (PAYLOADS.length + 2) + " scenarios");
}

module.exports = run;
if (require.main === module) run();
