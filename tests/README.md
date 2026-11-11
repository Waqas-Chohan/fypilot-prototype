# Activity 5 — automated security tests

Pure Node.js + [jsdom](https://github.com/jsdom/jsdom) (a dev-only test dependency —
the site itself ships zero dependencies and still runs by double-clicking any `.html` file).

```bash
npm install   # installs jsdom, used only by these tests
npm test      # or: node tests/run-tests.js
```

| File | Covers |
| --- | --- |
| `file-validation.test.js` | Task 3 — file extension / size validation rules |
| `password-strength.test.js` | Task 5 — the instructor-provided `checkPasswordStrength()` |
| `xss-feedback.test.js` | Task 2 — XSS payloads sent through the real Supervisor feedback composer |
| `signup-validation.test.js` | Task 1 — sign-up form validation + the live password-strength meter |

Each test loads the **actual, unmodified** `assets/js/*.js` files the browser uses (via
`jsdom`'s `runScripts: "dangerously"`), builds the relevant piece of markup, and drives it
the same way a user would — it is not re-implementing the logic separately.
