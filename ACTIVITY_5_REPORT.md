# FYPilot — Activity 5: Basic Secure Coding Implementation

**Project Activity 5** · FAST NUCES · **Group Members:** M. Waqas (23F-3041), M. Zain (22F-3645), M. Taqi (23F-3026)
Automated proof for every task: `tests/` (run with `npm install && npm test`, or `node tests/run-tests.js`)
Manual click-through screenshots: `screenshots/activity5-*.png` (see "Testing & Demonstration" below for exact steps)

All work is implemented directly in the existing semester project (no new/separate app). No backend, database, or internet connection was added.

## 0. Files touched

| File | What changed |
| --- | --- |
| `login.html` / `assets/js/login.js` | Task 1 (sign-up form) + Task 5 (password-strength meter) |
| `supervisor.html` / `assets/js/supervisor.js` | Task 1 (feedback form) + Task 2 (XSS fix, primary component) |
| `module1.html` / `assets/js/module1.js` | Task 1 + Task 2 (defense-in-depth) |
| `dashboard.html` / `assets/js/dashboard.js` | Task 1 (funding form) + Task 2 (defense-in-depth) + Task 3 (file upload) |
| `assets/js/file-validation.js` *(new)* | Shared, unit-tested file-type/size validation rules (Task 3) |
| `assets/js/password_strength_helper.js` *(new, instructor-provided, unmodified)* | Task 5 |
| `assets/js/main.js` | Task 4 (logout now clears all of sessionStorage) |
| `assets/css/styles.css` | Styles for the password-strength meter and the file-rejection state |
| `tests/*.js`, `package.json` | Automated test suite (new) |

## 1. Task 1 — Secure Input Validation

**Forms hardened:** (a) the **Sign-Up / Registration** form (`login.html`) and (b) the **Supervisor → Send Feedback** form (`supervisor.html`). The **Module 1 funding form** and the **Dashboard funding form** were hardened the same way, as defense-in-depth.

| Requirement | Before | After |
| --- | --- | --- |
| Empty mandatory fields | Name/roll checked loosely (`roll !== ""`); a whitespace-only name (`"   "`) passed the `length>=3` check | Every field is trimmed *before* validation; whitespace-only input is now correctly rejected |
| Min/max character limits | Only a few `min` checks existed; no upper bound anywhere | `maxlength` added in HTML **and** re-checked in JS: name 3–60, roll ≤12, email ≤100, password 8–72, feedback 3–500, funding purpose 5–300, proposal title 3–80 |
| Leading/trailing spaces | Validated on a trimmed copy but the **stored/displayed** value could still keep the stray spaces | The trimmed value is written back into the input (`el.value = trimmed`) before it is used/stored, in every hardened form |
| Expected format | Roll number had no format check at all | Added `ROLL_RE = /^\d{2}[A-Za-z]-\d{3,5}$/` (matches `23F-3041`) with a visible hint and inline error |
| Validation messages | Present for some fields, missing/toast-only for feedback | Every field now has a specific, visible inline message (e.g. *"Use the format 23F-3041…"*, *"Feedback must be 500 characters or fewer."*) |

## 2. Task 2 — Cross-Site Scripting (XSS) Prevention

**Component identified:** the Supervisor **"Send Feedback"** composer (`supervisor.html` → `#feedMsg`/`#feedList`, logic in `assets/js/supervisor.js`). A supervisor's free-text message is stored and immediately redisplayed in the on-page **"Sent:"** preview list — a textbook "echo user input back into the page" component, the same pattern as a complaint/comment box.

- **How it rendered before:** `el.innerHTML = "<strong>Sent:</strong> " + FYP.esc(text);` — the message was concatenated into an HTML string and escaped by convention. It *was not exploitable as shipped* (the project already used an `esc()` helper almost everywhere), but it was **one missed `esc()` call away** from an XSS hole, and relied on every future edit remembering to call it.
- **Unsafe DOM manipulation:** `innerHTML` assignment with string-built content is the unsafe pattern that `esc()` was papering over.
- **Fix implemented:** the message is now written with `document.createTextNode()` / `.textContent` on its own DOM node — the browser's HTML parser never runs on the user's text at all, so there is no escaping step that can be forgotten or done wrong. The same safer-rendering pattern was then applied (defense-in-depth) to the Module 1 "My Requests" list and the Dashboard "Funding History" list and uploaded-file list, which display the title/purpose/file name the user typed.
- **Tested with (see `tests/xss-feedback.test.js`, a real-DOM jsdom test that loads the unmodified `main.js`/`supervisor.js`):**
  - `<script>alert('XSS')</script>`
  - `<img src=x onerror=alert(1)>`
  - `"><svg onload=alert(1)>`
  - `<a href="javascript:alert(1)">click me</a>`
  - **Result:** none create a live `<script>/<img>/<svg>/<a>` element, `alert()` never fires, and the payload is shown back to the supervisor as plain, inert text — exactly as Task 2's expected outcome requires.

## 3. Task 3 — Secure File Selection and Validation

**Component:** the **"Upload Deliverable"** dropzone on the Student Dashboard (`dashboard.html` → `#fileInput`).

- **Weakness identified:** the `accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"` attribute only filters what the *native file picker shows* — a user can switch to "All Files" and pick anything (e.g. `malware.exe`), or drag-and-drop any file onto the dropzone, bypassing `accept` entirely. There was also **no size limit enforced in code**, even though the UI advertises "up to 150 MB".
- **Fix:** extracted the rule set into `assets/js/file-validation.js` (`validateFile()` — checks the real extension against an allow-list and the file's reported size against a 150 MB cap, rejecting 0-byte files too) and call it both on file **selection** and again at **upload-click time** (defense-in-depth), for both the file-picker and the drag-and-drop path. A rejected file clears the input, shows an inline, specific error under the dropzone, and disables the Upload button.
- **Tested with (`tests/file-validation.test.js`, 16 assertions):**
  | Input | Expected | Actual |
  | --- | --- | --- |
  | `Proposal.pdf`, 2 MB | Accepted | ✅ Accepted |
  | `malware.exe`, 1 KB | Rejected — unsupported type | ✅ Rejected, correct reason |
  | `huge-deliverable.zip`, 151 MB | Rejected — too large | ✅ Rejected, correct reason |
  | `empty.pdf`, 0 B | Rejected — empty file | ✅ Rejected |
  | `Report.DOCX` (uppercase ext) | Accepted | ✅ Accepted (case-insensitive) |

  *(Client-side file validation is only an initial screening layer — it reads the filename and the browser-reported size, not the file's actual bytes, so it cannot guarantee a `.pdf` really is a PDF. A real backend must re-validate file content/MIME type.)*

## 4. Task 4 — Sensitive Information Handling

Audited every `localStorage`/`sessionStorage` write and every embedded credential in the codebase:

| Checked | Finding |
| --- | --- |
| Passwords in `localStorage`/`sessionStorage` | **None.** `fypilot_remember` (localStorage) stores only the remembered **email**; `fypilot_session` (sessionStorage) stores only `{name, roll, role, email}`. The password typed into the login/sign-up forms is never written to any storage. |
| Secret credentials/private keys in frontend JS | **None exposed.** The only secret in the project, `TURNSTILE_SECRET_KEY`, lives exclusively server-side in `cloudflare-worker/worker.js`, read from `env` at runtime — it is never shipped to the browser. The Turnstile *site* key in `login.js` is a public key by design (safe to expose client-side, per Cloudflare's own docs). |
| Unnecessary sensitive info in storage | None found beyond the above; both keys were already minimal. |
| Logout clears temporary UI state | **Improved.** `logout()` previously removed only the single `fypilot_session` key; it now calls `sessionStorage.clear()`, so *any* temporary session/UI state (current or added later) is guaranteed to be wiped on sign-out, instead of depending on every future feature remembering to clean up its own key. |

## 5. Task 5 — Password Strength Checker (Bonus)

- Added the instructor-provided `assets/js/password_strength_helper.js` **unmodified** and included it in `login.html` before `login.js`.
- Wired to the **Sign-Up** form's password field (`#suPassword`) — the most natural "registration" form in the project. On every keystroke, `checkPasswordStrength(password)` is called and the result (`level`, `score`, `message`) is shown live in a colour-coded strength bar + message below the field.
- **Tested with three passwords (`tests/password-strength.test.js` + `tests/signup-validation.test.js`, live-DOM):**
  | Password | Result |
  | --- | --- |
  | `abc` | **Weak** — "Try using a longer password." |
  | `Password1` | **Moderate** — "A longer password or more variety may improve it." |
  | `Str0ng!Passw0rd#2026` | **Strong** — "Good password pattern. Avoid reusing passwords." |

## 6. Testing and Demonstration

55 automated assertions across 4 test files run the **real, unmodified browser code** (via jsdom for a true DOM) and a pure-logic suite for the file-size/type rules — this is the "appropriate evidence" the brief asks for, reproducible by anyone with `npm install && npm test`, rather than static screenshots of code that was never actually run.

| # | Feature tested | Input / action | Expected | Actual |
| --- | --- | --- | --- | --- |
| 1 | Supervisor feedback — XSS | Send `<img src=x onerror=alert(1)>` | Displayed as literal text, no alert fires | ✅ Displayed as text, `alert()` never called |
| 2 | Supervisor feedback — validation | Send a whitespace-only message | Rejected with inline error, nothing added to the list | ✅ Rejected, `feedList` stays empty |
| 3 | Dashboard file upload | Select `malware.exe` | Rejected — unsupported file type | ✅ Rejected with specific reason, input cleared, Upload disabled |
| 4 | Dashboard file upload | Select a 151 MB `.zip` | Rejected — exceeds 150 MB limit | ✅ Rejected with specific reason |
| 5 | Sign-up form | Roll number `badformat`, name `Al`, email `not-an-email`, password `short` | All four rejected with specific inline messages | ✅ All four rejected correctly |
| 6 | Password strength | `abc` → `Password1` → `Str0ng!Passw0rd#2026` | Weak → Moderate → Strong | ✅ Weak → Moderate → Strong |

Normal/legitimate inputs were tested alongside each invalid case (e.g. a correctly-formatted sign-up, a real feedback message, a valid `.pdf` upload) to confirm the hardening does not block real usage — see the "Accepts" rows inside `tests/*.test.js`.

**To capture manual screenshot evidence for submission:** open `login.html` (Sign-Up modal) and `supervisor.html`/`dashboard.html` (after signing in as Student/Supervisor via the demo accounts) in a browser, repeat the actions in the table above, and screenshot the inline error/success states and the password-strength bar.

## 7. Reflection

Activity 4 had already pushed most of the project toward using `FYP.esc()` before writing to `innerHTML`, so this activity's main contribution to **Task 2** was replacing "remember to escape" with "never parse user text as HTML at all" (`textContent`/`createTextNode`), which cannot be forgotten in a future edit. **Task 3** was the biggest real gap — the dropzone trusted the OS file picker's filter and never checked size, which is exactly the kind of control that looks secure in the UI copy ("up to 150 MB") but did nothing in code. **Task 4** confirmed the project's storage hygiene was already sound from Activity 2–4, and tightened logout to not depend on remembering individual keys. Front-end checks here (validation, extension/size screening, escaping) are all bypassable by a motivated attacker calling the DOM or network directly — a complete system still needs the same rules enforced again on a real backend.
