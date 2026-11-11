const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, AlignmentType, PageOrientation,
  LevelFormat, convertInchesToTwip
} = require("/opt/npm-tools/node_modules/docx");

const IMG_DIR = path.join(__dirname, "..", "..", "screenshots", "activity5", "resized");
const OUT = path.join(__dirname, "..", "..", "ACTIVITY_5_REPORT.docx");

function img(name, widthPx = 900, heightPx = 633, scale = 0.62) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 200 },
    children: [
      new ImageRun({
        type: "png",
        data: fs.readFileSync(path.join(IMG_DIR, name)),
        transformation: { width: Math.round(widthPx * scale), height: Math.round(heightPx * scale) }
      })
    ]
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text, italics: true, size: 20, color: "555555" })]
  });
}

function h1(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_1 }); }
function h2(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_2 }); }
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] });
}
function bullet(text) {
  return new Paragraph({ text, numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 } });
}
function checkedItem(text) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: "☑  " + text })]
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width || { size: 2000, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "0B1530" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: !!opts.header, color: opts.header ? "FFFFFF" : "000000", size: opts.size || 20 })]
    })]
  });
}

function table(headerRow, rows, widths) {
  const colWidths = widths || headerRow.map(() => Math.floor(9360 / headerRow.length));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerRow.map((t, i) => cell(t, { header: true, width: { size: colWidths[i], type: WidthType.DXA } }))
      }),
      ...rows.map(r => new TableRow({
        children: r.map((t, i) => cell(t, { width: { size: colWidths[i], type: WidthType.DXA } }))
      }))
    ]
  });
}

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) } } } }]
    }]
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
      title: { run: { font: "Calibri", size: 44, bold: true, color: "0B1530" }, paragraph: { spacing: { after: 160 }, keepNext: true } },
      heading1: { run: { font: "Calibri", size: 30, bold: true, color: "0B1530" }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true } },
      heading2: { run: { font: "Calibri", size: 25, bold: true, color: "2451B8" }, paragraph: { spacing: { before: 260, after: 120 }, keepNext: true } }
    }
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 } } },
    children: [
      new Paragraph({ text: "Project Activity 5", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: "Basic Secure Coding Implementation in Existing Semester Project", bold: true, size: 26 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
        children: [new TextRun({ text: "Project: FYPilot — FYP Lifecycle Platform  |  FAST NUCES", size: 22, color: "444444" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
        children: [new TextRun({ text: "Group Members: M. Waqas (23F-3041) · M. Zain (22F-3645) · M. Taqi (23F-3026)", size: 22, color: "444444" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 },
        children: [new TextRun({ text: "Repository: github.com/Waqas-Chohan/fypilot-prototype  |  Live: fypilot.vercel.app", size: 20, color: "666666" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
        children: [new TextRun({ text: "Development Environment: HTML, CSS, JavaScript  ·  No backend / database / internet required", size: 20, color: "666666", italics: true })] }),

      // ---------------- 1. Objective ----------------
      h1("1. Objective"),
      p("This activity improves the security of our existing FYPilot semester project by implementing basic secure-coding practices. All work below was carried out directly inside the existing project (login.html, dashboard.html, supervisor.html, module1.html and their JavaScript) — no separate application was built for this activity, per the brief's instructions."),
      p("All five tasks were completed and verified end-to-end against the running application using an automated headless-browser walkthrough (Playwright) and an automated unit/DOM test suite (55 assertions, tests/). Screenshots in this report are real captures of the actual app, not mockups."),

      // ---------------- Task 1 ----------------
      h1("Task 1: Secure Input Validation"),
      p("Forms hardened: the Sign-Up / Registration form (login.html) and the Supervisor → Send Feedback form (supervisor.html). The Module 1 and Dashboard funding forms were hardened the same way as defense-in-depth."),
      h2("What was implemented"),
      bullet("Mandatory fields: every value is trimmed before validation, so whitespace-only input (e.g. \"   \") is correctly rejected, not silently accepted."),
      bullet("Min/max character limits: name 3–60, roll ≤12, email ≤100, password 8–72, feedback 3–500, funding purpose 5–300, proposal title 3–80 — enforced in both the HTML (maxlength) and JavaScript."),
      bullet("Leading/trailing spaces: the trimmed value is written back into the input before it is used or displayed, in every hardened form."),
      bullet("Expected format: a roll-number pattern was added, /^\\d{2}[A-Za-z]-\\d{3,5}$/, matching the real format (e.g. 23F-3041), with a visible hint and inline error."),
      bullet("Validation messages: every field shows a specific, visible inline error instead of a generic/toast-only message."),
      h2("Evidence — Sign-Up form rejecting invalid input"),
      img("t1-signup-invalid.png"),
      caption("Name too short, bad roll-number format, invalid email, and a too-short password are all flagged inline at the same time."),
      h2("Evidence — Sign-Up form accepting valid input"),
      img("t1-signup-valid-success.png"),
      caption("A correctly-formatted registration (23F-3041, university email, 8+ character password, code of conduct accepted) succeeds."),
      h2("Evidence — Supervisor feedback form: empty input rejected"),
      img("t1-feedback-empty-rejected.png"),
      caption("A whitespace-only feedback message is rejected with an inline error; nothing is added to the “Sent” list."),
      h2("Evidence — Supervisor feedback form: valid input accepted"),
      img("t1-feedback-valid-sent.png"),
      caption("A valid feedback message is accepted and appears at the top of the “Sent” list."),

      // ---------------- Task 2 ----------------
      h1("Task 2: Cross-Site Scripting (XSS) Prevention"),
      p("Component identified: the Supervisor “Send Feedback” composer (supervisor.html → #feedMsg / #feedList). A supervisor's free-text message is stored and immediately redisplayed in the on-page “Sent:” preview list — the same “echo user input back into the page” pattern as a complaint or comment box."),
      h2("How it displayed user-provided information"),
      p("Before: el.innerHTML = \"<strong>Sent:</strong> \" + FYP.esc(text); — the message was concatenated into an HTML string and escaped by convention. It was not exploitable as shipped (the project already used an esc() helper almost everywhere), but it was one missed esc() call away from an XSS hole, and relied on every future edit remembering to call it."),
      h2("Unsafe DOM manipulation identified"),
      p("Building HTML via string concatenation and assigning it to innerHTML is the unsafe pattern — it requires every call site to escape correctly, forever."),
      h2("Safer rendering implemented"),
      p("The message is now written with document.createTextNode() / .textContent on its own DOM node, so the browser's HTML parser never runs on the user's text at all. There is no escaping step left to forget. The same safer pattern was then applied, as defense-in-depth, to the Module 1 “My Requests” list and the Dashboard “Funding History” / uploaded-files lists."),
      h2("Tested with instructor-style malicious input"),
      bullet("<script>alert('XSS')</script>"),
      bullet("<img src=x onerror=alert(1)>"),
      bullet("\"><svg onload=alert(1)>"),
      bullet("<a href=\"javascript:alert(1)\">click me</a>"),
      p("Result (verified both by an automated jsdom test and by the live browser capture below): none of these create a live <script>/<img>/<svg>/<a> element, no alert() ever fires, and the payload is shown back to the supervisor as plain, inert text."),
      h2("Evidence — malicious payload neutralised in the live app"),
      img("t2-xss-payload-neutralised.png"),
      caption("The payload <img src=x onerror=alert('XSS')> was typed into the feedback box and sent. It is displayed as literal text in the “Sent” list — no alert dialog appeared (confirmed programmatically: zero JS dialogs fired during capture)."),

      // ---------------- Task 3 ----------------
      h1("Task 3: Secure File Selection and Validation"),
      p("Component: the “Upload Deliverable” dropzone on the Student Dashboard (dashboard.html → #fileInput)."),
      h2("Weakness identified"),
      p("The accept=\".pdf,.doc,.docx,.ppt,.pptx,.zip\" attribute only filters what the native file picker shows — a user can switch to “All Files” and pick anything (e.g. malware.exe), or drag-and-drop any file onto the dropzone, bypassing accept entirely. There was also no size limit enforced in code, even though the UI advertises “up to 150 MB”."),
      h2("Fix implemented"),
      p("Extracted the rule set into assets/js/file-validation.js (validateFile()), which checks the real file extension against an allow-list and the file's reported size against a 150 MB cap, and rejects 0-byte files. This is called both when a file is selected and again at upload-click time (defense-in-depth), for both the file-picker and the drag-and-drop path. A rejected file clears the input, shows a specific inline error under the dropzone, and disables the Upload button."),
      h2("Evidence — unsupported file type rejected"),
      img("t3-file-rejected-extension.png"),
      caption("Selecting malware.exe is rejected: “Unsupported file type (.exe). Allowed types: .pdf, .doc, .docx, .ppt, .pptx, .zip.”"),
      h2("Evidence — oversized file rejected"),
      img("t3-file-rejected-oversize.png"),
      caption("Selecting a real 151 MB .zip file is rejected: “File is too large (151.0 MB). Maximum allowed size is 150.0 MB.”"),
      h2("Evidence — permitted file accepted and uploaded"),
      img("t3-file-upload-success.png"),
      caption("A valid Proposal_v3.pdf is accepted, uploaded, and appears in the deliverables list — proving legitimate use still works after the rejections above."),

      // ---------------- Task 4 ----------------
      h1("Task 4: Sensitive Information Handling"),
      p("Audited every localStorage/sessionStorage write and every embedded credential in the codebase:"),
      table(
        ["Checked", "Finding"],
        [
          ["Passwords in localStorage/sessionStorage", "None. “fypilot_remember” (localStorage) stores only the remembered email; “fypilot_session” (sessionStorage) stores only {name, roll, role, email}. The typed password is never written to any browser storage."],
          ["Secret credentials / private keys in frontend JS", "None exposed. The only secret, TURNSTILE_SECRET_KEY, lives exclusively in the server-side Cloudflare Worker (cloudflare-worker/worker.js), read from env at runtime. The Turnstile site key in login.js is a public key by design."],
          ["Unnecessary sensitive info in storage", "None found beyond the above; both keys were already minimal."],
          ["Logout clears temporary UI state", "Improved: logout() previously removed only the single fypilot_session key; it now calls sessionStorage.clear(), guaranteeing all temporary session/UI state is wiped on sign-out."]
        ],
        [3100, 6260]
      ),
      new Paragraph({ spacing: { before: 200 } }),
      h2("Evidence — live storage contents after signing in as a student"),
      img("t4-storage-audit.png"),
      caption("On-page dump of the real sessionStorage/localStorage contents while signed in: only the display profile and remembered email are present — no password, token or secret anywhere."),
      p("Additionally confirmed automatically: after calling Logout, sessionStorage contains 0 keys (verified in the same browser session that produced the screenshot above)."),

      // ---------------- Task 5 ----------------
      h1("Task 5: Password Strength Checker (Bonus)"),
      p("The instructor-provided assets/js/password_strength_helper.js was added unmodified and included in login.html before login.js. It was wired to the Sign-Up form's password field (#suPassword) — the project's registration form. On every keystroke, checkPasswordStrength(password) is called and the result is shown live as a colour-coded strength bar and message below the field."),
      h2("Tested with three passwords"),
      table(
        ["Password", "Result"],
        [
          ["abc", "Weak — “Try using a longer password.”"],
          ["Password1", "Moderate — “A longer password or more variety may improve it.”"],
          ["Str0ng!Passw0rd#2026", "Strong — “Good password pattern. Avoid reusing passwords.”"]
        ],
        [3600, 5760]
      ),
      new Paragraph({ spacing: { before: 200 } }),
      h2("Evidence"),
      img("t5-password-weak.png"), caption("Weak — \"abc\""),
      img("t5-password-moderate.png"), caption("Moderate — \"Password1\""),
      img("t5-password-strong.png"), caption("Strong — \"Str0ng!Passw0rd#2026\""),

      // ---------------- 4. Testing and Demonstration ----------------
      h1("4. Testing and Demonstration"),
      p("55 automated assertions across 4 test files (tests/, run via npm install && npm test) drive the real, unmodified application code through jsdom (a true DOM) plus a pure-logic suite for the file-size/type rules. The table below gives the ≥ 3 required test cases, each backed by both an automated assertion and a manual screenshot above."),
      table(
        ["#", "Feature tested", "Test input / action", "Expected result", "Actual result"],
        [
          ["1", "Supervisor feedback — XSS", "Send <img src=x onerror=alert(1)>", "Displayed as literal text, no alert", "Displayed as text; alert() never called"],
          ["2", "Supervisor feedback — validation", "Send a whitespace-only message", "Rejected with inline error", "Rejected; feedback list unchanged"],
          ["3", "Dashboard file upload", "Select malware.exe", "Rejected — unsupported type", "Rejected with specific reason; Upload disabled"],
          ["4", "Dashboard file upload", "Select a 151 MB .zip", "Rejected — exceeds 150 MB", "Rejected with specific reason"],
          ["5", "Sign-up form", "Roll badformat, name “Al”, email not-an-email, password short", "All 4 rejected with specific messages", "All 4 rejected correctly"],
          ["6", "Password strength", "abc → Password1 → Str0ng!Passw0rd#2026", "Weak → Moderate → Strong", "Weak → Moderate → Strong"]
        ],
        [500, 2300, 2900, 2000, 1660]
      ),
      new Paragraph({ spacing: { before: 200 } }),
      p("Normal/legitimate inputs were tested alongside each invalid case (a correctly-formatted sign-up, a real feedback message, a valid .pdf upload) to confirm the hardening does not block real usage — see the screenshots above and the “Accepts” assertions in tests/*.test.js."),

      // ---------------- 5. Submission Requirements ----------------
      h1("5. Submission Requirements"),
      bullet("Updated Source Code: complete updated project in the repository (all changes listed in section 0 below)."),
      bullet("Implementation Evidence: screenshots above for every task."),
      bullet("Testing Evidence: the 6-case table in section 4, each backed by an automated assertion."),
      bullet("Brief Explanation: the weaknesses and fixes are described under each task heading above."),
      p("All modifications are integrated into the existing FYPilot semester project — no separate application was created.", {}),

      h2("Files changed"),
      table(
        ["File", "What changed"],
        [
          ["login.html / assets/js/login.js", "Task 1 (sign-up form) + Task 5 (password-strength meter)"],
          ["supervisor.html / assets/js/supervisor.js", "Task 1 (feedback form) + Task 2 (XSS fix, primary component)"],
          ["module1.html / assets/js/module1.js", "Task 1 + Task 2 (defense-in-depth)"],
          ["dashboard.html / assets/js/dashboard.js", "Task 1 (funding form) + Task 2 (defense-in-depth) + Task 3 (file upload)"],
          ["assets/js/file-validation.js (new)", "Shared, unit-tested file-type/size validation rules (Task 3)"],
          ["assets/js/password_strength_helper.js (new, instructor-provided, unmodified)", "Task 5"],
          ["assets/js/main.js", "Task 4 (logout now clears all of sessionStorage)"],
          ["assets/css/styles.css", "Styles for the password-strength meter and file-rejection state"],
          ["tests/*.js, package.json (new)", "Automated test suite (55 assertions)"]
        ],
        [4200, 5160]
      ),
      new Paragraph({ spacing: { before: 200 } }),

      // ---------------- 6. Security Considerations ----------------
      h1("6. Important Security Considerations"),
      p("This activity is frontend-only, as required. The controls implemented here are an additional layer, not a replacement for server-side enforcement:"),
      bullet("Frontend input validation (Task 1) must also be performed on the server in a complete application."),
      bullet("Hiding buttons or restricting interface elements does not provide real authorization."),
      bullet("Client-side file validation (Task 3) checks the filename extension and reported size only — it cannot guarantee a “.pdf” is really a PDF; a backend must re-validate actual file content/MIME type."),
      bullet("Browser storage (Task 4) must not be treated as a trusted location for sensitive information — none is stored here, but this remains true generally."),
      bullet("Real authentication and authorization require appropriate backend implementation."),

      // ---------------- 7. Final Completion Checklist ----------------
      h1("7. Final Completion Checklist"),
      h2("Task 1: Secure Input Validation"),
      checkedItem("Selected at least two existing forms (Sign-Up, Supervisor Feedback)."),
      checkedItem("Implemented mandatory field validation."),
      checkedItem("Implemented minimum and maximum character limits."),
      checkedItem("Added appropriate validation messages."),
      h2("Task 2: XSS Prevention"),
      checkedItem("Identified a component displaying user-provided information (Supervisor Feedback list)."),
      checkedItem("Identified the unsafe rendering pattern (innerHTML string concatenation)."),
      checkedItem("Implemented safer rendering (textContent / createTextNode)."),
      checkedItem("Tested the component using malicious input (4 payloads, automated + manual)."),
      h2("Task 3: Secure File Selection"),
      checkedItem("Implemented file extension restrictions."),
      checkedItem("Implemented file size restrictions (150 MB)."),
      checkedItem("Tested permitted and unsupported files (and oversized files)."),
      h2("Task 4: Sensitive Information Handling"),
      checkedItem("Checked browser storage for sensitive information."),
      checkedItem("Confirmed passwords are not stored in browser storage."),
      checkedItem("Confirmed no unnecessary sensitive information is present."),
      checkedItem("Verified logout clears temporary frontend state (sessionStorage.clear())."),
      h2("Task 5: Password Strength Checker (Bonus)"),
      checkedItem("Downloaded the provided JavaScript file."),
      checkedItem("Included the file in the project, unmodified."),
      checkedItem("Successfully called checkPasswordStrength()."),
      checkedItem("Displayed password strength feedback."),
      checkedItem("Tested Weak, Moderate, and Strong password examples."),
      h2("Testing and Submission"),
      checkedItem("Completed at least three security test cases (6 completed)."),
      checkedItem("Captured screenshots of implemented improvements."),
      checkedItem("Updated the existing semester project source code."),
      checkedItem("Prepared a brief explanation of identified weaknesses and solutions."),
      checkedItem("Verified that all required files are included in the submission."),

      h1("Reflection"),
      p("Earlier activities had already pushed most of the project toward using FYP.esc() before writing to innerHTML, so this activity's main contribution to Task 2 was replacing “remember to escape” with “never parse user text as HTML at all” (textContent / createTextNode), which cannot be forgotten in a future edit. Task 3 was the biggest real gap — the dropzone trusted the OS file picker's filter and never checked size, which looks secure in the UI copy (“up to 150 MB”) but did nothing in code. Task 4 confirmed the project's storage hygiene was already sound, and tightened logout to not depend on remembering individual keys. Front-end checks here (validation, extension/size screening, escaping) are all bypassable by a motivated attacker calling the DOM or network directly — a complete system still needs the same rules enforced again on a real backend.")
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("Wrote", OUT, buf.length, "bytes");
});
