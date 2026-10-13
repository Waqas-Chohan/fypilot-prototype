/* ==========================================================================
   FYPilot - dependency-model.js (Activity 4)
   Generated from the Activity 4 dependency analysis. Same data as the report:
   components C1-C9, direct dependencies (row depends on column) and the matrix.
   ========================================================================== */
window.FYP_DEPS = {
  "components": [
    {
      "id": "C1",
      "name": "Landing Page",
      "files": "index.html",
      "resp": "Public entry point: explains FYPilot, links to Login and hosts the contact form.",
      "group": "pages"
    },
    {
      "id": "C2",
      "name": "Authentication Module",
      "files": "login.html, assets/js/login.js",
      "resp": "Validates university credentials, identifies the role, creates the user session and routes the user to the correct dashboard; sign-up and password-reset forms.",
      "group": "identity"
    },
    {
      "id": "C3",
      "name": "Bot-Verification Service",
      "files": "Cloudflare Turnstile + cloudflare-worker/worker.js",
      "resp": "Proves that a sign-in is made by a human; the Worker verifies the Turnstile token server-side with Cloudflare siteverify.",
      "group": "identity"
    },
    {
      "id": "C4",
      "name": "Shared UI Core",
      "files": "assets/js/main.js (UI helpers)",
      "resp": "Common utilities used by every page: toasts, modals, dropdowns, mobile navigation, HTML escaping (FYP.esc) and debounce.",
      "group": "core"
    },
    {
      "id": "C5",
      "name": "Session & Access Control",
      "files": "assets/js/main.js (session helpers) + sessionStorage",
      "resp": "Reads the current session, guards protected pages by role (FYP.requireRole) and logs users out (FYP.logout).",
      "group": "core"
    },
    {
      "id": "C6",
      "name": "Student Dashboard",
      "files": "dashboard.html, assets/js/dashboard.js",
      "resp": "Student home: milestone tracker, deliverable upload, originality check, funding requests, grades and masked group PII.",
      "group": "pages"
    },
    {
      "id": "C7",
      "name": "Supervisor Dashboard",
      "files": "supervisor.html, assets/js/supervisor.js",
      "resp": "Supervisor home: approve/reject funding (restricted function), rubric grading, feedback, full group contacts and audit log.",
      "group": "pages"
    },
    {
      "id": "C8",
      "name": "Proposal & Funding Module",
      "files": "module1.html, assets/js/module1.js",
      "resp": "Module 1: validated proposal + funding-request form stored in a JavaScript array with a live “My Requests” list.",
      "group": "pages"
    },
    {
      "id": "C9",
      "name": "FYP Archive Module",
      "files": "module2.html, assets/js/module2.js",
      "resp": "Module 2: search, filter and view details of past FYPs from a sample archive array.",
      "group": "pages"
    }
  ],
  "deps": [
    {
      "from": "C1",
      "to": "C4",
      "reason": "Mobile navigation, scroll-reveal and contact-form validation/toast are provided by main.js."
    },
    {
      "from": "C2",
      "to": "C3",
      "reason": "The Login button stays disabled until Turnstile issues a token (verified by the Worker when configured)."
    },
    {
      "from": "C2",
      "to": "C4",
      "reason": "Sign-up and forgot-password modals, demo-account autofill feedback and toasts come from main.js."
    },
    {
      "from": "C5",
      "to": "C2",
      "reason": "requireRole() can only admit a user after login.js has written a valid ‘fypilot_session’ record."
    },
    {
      "from": "C6",
      "to": "C4",
      "reason": "Uses FYP.toast / FYP.esc / modals for uploads, funding requests and notifications."
    },
    {
      "from": "C6",
      "to": "C5",
      "reason": "Calls FYP.requireRole(['student']) before anything is rendered."
    },
    {
      "from": "C7",
      "to": "C4",
      "reason": "Uses FYP.toast / FYP.esc for approvals, grading, feedback and the audit log."
    },
    {
      "from": "C7",
      "to": "C5",
      "reason": "Calls FYP.requireRole(['supervisor']) to protect approvals and full PII."
    },
    {
      "from": "C8",
      "to": "C4",
      "reason": "Uses FYP.esc for safe output and FYP.toast for success/error feedback."
    },
    {
      "from": "C8",
      "to": "C5",
      "reason": "Calls FYP.requireRole() — only signed-in users may submit requests."
    },
    {
      "from": "C9",
      "to": "C4",
      "reason": "Uses FYP.debounce for live search and FYP.openModal for the details view."
    },
    {
      "from": "C9",
      "to": "C5",
      "reason": "Calls FYP.requireRole() — only signed-in users may browse the archive."
    }
  ],
  "nonDeps": [
    {
      "from": "C2",
      "to": "C6 / C7",
      "reason": "Login only redirects to a dashboard after authenticating; a broken dashboard does not stop authentication itself."
    },
    {
      "from": "C6",
      "to": "C8 / C9",
      "reason": "The Student Dashboard only links to the modules (navigation), it does not need them to work."
    },
    {
      "from": "C7",
      "to": "C8",
      "reason": "In the prototype the supervisor’s funding queue is sample data; it does not read Module 1’s array (this becomes a dependency on a shared Funding database in the backend phase)."
    },
    {
      "from": "C2",
      "to": "C5",
      "reason": "login.js writes sessionStorage itself instead of calling main.js — so there is no code dependency, but the session key and role-to-page route table are duplicated in two files (hidden coupling)."
    }
  ],
  "ids": [
    "C1",
    "C2",
    "C3",
    "C4",
    "C5",
    "C6",
    "C7",
    "C8",
    "C9"
  ],
  "matrix": [
    [
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      1,
      1,
      0,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    [
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      1,
      1,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      1,
      1,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      1,
      1,
      0,
      0,
      0,
      0
    ],
    [
      0,
      0,
      0,
      1,
      1,
      0,
      0,
      0,
      0
    ]
  ]
};
