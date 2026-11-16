const fs = require("fs"), path = require("path");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, PageBreak } = require("/opt/npm-tools/node_modules/docx");
const DIR = path.join(__dirname, "..", "..", "screenshots", "activity6");
const OUT = path.join(__dirname, "..", "..", "ACTIVITY_6_REPORT.docx");
const ROOT = path.join(__dirname, "..", "..");

function png(file, maxW = 560) {
  const b = fs.readFileSync(path.join(DIR, file));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const maxH = 520; let k = maxW / w; if (h * k > maxH) k = maxH / h;
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 }, keepNext: true,
    children: [new ImageRun({ type: "png", data: b, transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] });
}
const cap = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: t, italics: true, size: 19, color: "555555" })] });
const shot = (f, c, w) => [png(f, w), cap(c)];
const h1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
const h2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
const p = (t, o = {}) => new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: t, ...o })] });
const b = t => new Paragraph({ text: t, numbering: { reference: "bl", level: 0 }, spacing: { after: 60 } });
const code = t => new Paragraph({ spacing: { after: 60 }, shading: { type: ShadingType.CLEAR, fill: "F1F5F9" }, children: [new TextRun({ text: t, font: "Consolas", size: 18 })] });

function tbl(head, rows, widths) {
  const total = widths.reduce((a, c) => a + c, 0);
  const mk = (t, w, hd) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: hd ? { type: ShadingType.CLEAR, fill: "0B1530" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: hd, color: hd ? "FFFFFF" : "000000", size: 19 })] })] });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: head.map((t, i) => mk(t, widths[i], true)) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((t, i) => mk(t, widths[i], false)) }))] });
}

const eps = [
  ["GET", "/api/health", "None", "Health check"],
  ["POST", "/api/auth/register", "None", "Create a student account (role is forced to student server-side)"],
  ["POST", "/api/auth/login", "None", "Verify credentials, return signed JWT"],
  ["GET", "/api/auth/me", "JWT", "Current user profile"],
  ["GET", "/api/funding", "JWT", "Student: own requests. Supervisor: all requests"],
  ["POST", "/api/funding", "JWT", "Submit a funding request (Module 1 insert)"],
  ["PUT", "/api/funding/<id>", "JWT + supervisor", "Approve / reject a request (RBAC)"],
  ["GET", "/api/archive", "JWT", "Browse/search archive (Module 2 retrieve)"],
  ["GET", "/api/archive/<id>", "JWT", "Archive project detail"],
  ["POST", "/api/archive", "JWT + supervisor/coordinator/library", "Add archive entry (RBAC)"],
  ["GET", "/api/dashboard/stats", "JWT", "Role-aware dashboard counts"],
  ["GET", "/api/dashboard/notifications", "JWT", "Latest notifications"],
];

const kids = [
  new Paragraph({ text: "FYPilot — Activity 6", heading: HeadingLevel.TITLE }),
  p("Backend Development and Integration of the Existing Semester Project", { bold: true, size: 26 }),
  p("Secure Software Development · Development Activity 6 · FAST NUCES"),
  p("Stack: Python Flask · PostgreSQL · JWT (flask-jwt-extended) · Werkzeug password hashing · existing HTML/CSS/JS frontend"),
  p("Modules: Module 1 — Submit Proposal & Funding (Member 1) · Module 2 — FYP Archive Browser (Member 2). Both modules run on the same backend and database."),

  h1("1. Objective & What Was Done"),
  p("The existing FYPilot frontend (Activities 2–5) was connected to a real backend and database. No separate application was created. Mock arrays were replaced with API calls, and every protected route requires a valid JWT."),
  tbl(["Task", "Status", "Where"], [
    ["Task 1 — Backend setup & DB connectivity", "Done", "backend/app.py, backend/schema.sql"],
    ["Task 2 — Individual backend modules", "Done", "Funding (module1) and Archive (module2) endpoints"],
    ["Task 3 — Frontend–backend integration", "Done", "assets/js/main.js apiFetch(), module1.js, module2.js, dashboard.js, login.js"],
    ["Task 4 — Authentication & JWT", "Done", "/api/auth/login, hashed passwords, @jwt_required()"],
    ["Task 5 — Authorization & secure handling", "Done", "RBAC, validation, parameterised SQL, generic errors"],
    ["Task 6 — Testing & demonstration", "Done", "backend/tests/test_api.py + screenshots below"],
  ], [3600, 1100, 4660]),

  h1("2. Task 1 — Backend Setup and Database Connectivity"),
  b("Backend: Flask server (backend/app.py) started with python app.py on http://127.0.0.1:5000."),
  b("Database: PostgreSQL; connection string and JWT secret are read from backend/.env (never committed)."),
  b("Tables created by backend/schema.sql: users, funding_requests, archive_projects (UNIQUE(title, year) prevents duplicate seed rows)."),
  b("Data is stored (INSERT) and retrieved (SELECT) through the API; see the database screenshot."),
  ...shot("s14-database-rows.png", "Figure 1 — PostgreSQL tables after use. Passwords are stored as scrypt hashes, never plaintext.", 520),
  p("Setup commands:", { bold: true }),
  code("cd backend && pip install -r requirements.txt"),
  code("psql -U postgres -c \"CREATE DATABASE fypilot\"      (then set DATABASE_URL and JWT_SECRET_KEY in backend/.env)"),
  code("python app.py          # creates tables, seeds demo users, serves the API"),
  code("python -m http.server 8080     # in the project root, serves the frontend"),

  h1("3. Task 2 — Individual Backend Module Development"),
  h2("Module 1 — Submit Proposal & Funding"),
  b("Insert: POST /api/funding validates title (3–80), purpose (3–300), amount (1–10,000,000) and stores the request as Pending."),
  b("Retrieve: GET /api/funding returns the student's own requests (supervisors see all)."),
  b("Update (extra): PUT /api/funding/<id> lets only a supervisor approve or reject."),
  b("Success and failure paths return JSON with proper status codes (201, 400, 401, 403, 404)."),
  ...shot("s4-module1-form-filled.png", "Figure 2 — Module 1 form filled in the real frontend.", 480),
  ...shot("s5-module1-submitted-and-listed.png", "Figure 3 — Request submitted to the backend, stored in PostgreSQL and listed back (success toast).", 480),
  ...shot("s6-module1-validation-error.png", "Figure 4 — Invalid input is rejected with an error message.", 480),
  h2("Module 2 — FYP Archive Browser"),
  b("Retrieve: GET /api/archive (search + category filter, parameterised ILIKE) and GET /api/archive/<id>."),
  b("Insert: POST /api/archive, restricted to supervisor, coordinator or library roles."),
  ...shot("s7-module2-archive-from-db.png", "Figure 5 — Archive records loaded from the database.", 480),
  ...shot("s8-module2-archive-search.png", "Figure 6 — Search query sent to the backend; only matching records returned.", 480),

  h1("4. Task 3 — Frontend–Backend Integration"),
  b("assets/js/main.js adds apiFetch(), which sends Authorization: Bearer <token> on every call."),
  b("Login, funding, archive, dashboard stats/notifications and sign-up now call the API; the mock JavaScript arrays were removed."),
  b("Success and error responses are shown as toasts or inline messages."),
  ...shot("s2-student-dashboard-from-api.png", "Figure 7 — Student dashboard after logging in through the backend.", 480),
  ...shot("s9-dashboard-after-submission.png", "Figure 8 — Dashboard statistics and notifications served by the API.", 480),
  ...shot("s11-signup-saved-in-backend.png", "Figure 9 — Sign-up persisted via POST /api/auth/register.", 440),
  ...shot("s12-network-calls.png", "Figure 10 — Browser network log: frontend calls to /api endpoints and their status codes.", 520),

  h1("5. Task 4 — Authentication and JWT"),
  b("Server-side login: POST /api/auth/login looks up the user and verifies check_password_hash(); a generic message is returned for both unknown e-mail and wrong password."),
  b("Passwords are stored only as Werkzeug scrypt hashes (see Figure 1)."),
  b("A signed JWT (HS256, 1-hour expiry, secret from .env) is returned on success. The frontend keeps it in sessionStorage."),
  b("@jwt_required() guards every protected route. Missing, malformed, tampered and expired tokens all get HTTP 401 with a generic message."),
  ...shot("s1-login-form.png", "Figure 11 — Login form.", 440),
  ...shot("s3-login-failed-wrong-password.png", "Figure 12 — Wrong password: backend returns 401 and the UI shows the failure.", 440),
  ...shot("s10-supervisor-login-role-routing.png", "Figure 13 — Supervisor login routes to the supervisor workspace using the role returned by the backend.", 480),

  h1("6. Task 5 — Authorization and Secure Data Handling"),
  tbl(["Control", "Implementation"], [
    ["Role-based authorization", "PUT /api/funding/<id> supervisor only; POST /api/archive supervisor/coordinator/library only; student gets 403."],
    ["No privilege escalation", "Registration ignores any role sent by the client and always creates a student."],
    ["Server-side validation", "clean_str() enforces type and length; amount, year and status/similarity are range- or whitelist-checked."],
    ["SQL injection prevention", "All queries use psycopg2 %s placeholders; no string concatenation of user input."],
    ["Safe errors", "Global error handler returns generic JSON; debug mode is off, so no stack traces, SQL or driver messages leak."],
    ["Secrets", "JWT secret and DB URL come from backend/.env (git-ignored); the server refuses to start if they are missing."],
    ["CORS", "Only http://localhost:8080 and http://127.0.0.1:8080 may call the API."],
  ], [2600, 6760]),

  h1("7. Task 6 — Testing and Demonstration"),
  p("backend/tests/test_api.py runs 26 checks against the live server. All of them passed. Coverage maps to the required demo items:"),
  tbl(["Required demonstration", "Result"], [
    ["1. Successful login and JWT generation", "HTTP 200, token returned (Figures 11, 13, 14)"],
    ["2. Protected endpoint with valid token", "GET /api/auth/me → 200"],
    ["3. Missing / invalid / tampered token rejected", "No token, garbage token and altered signature → 401"],
    ["4. Role-based restrictions", "Student approve funding → 403; student add archive → 403; register with role=supervisor → created as student"],
    ["5. Submission and retrieval via frontend + backend", "Figures 2–6, 10"],
    ["6. Both modules demonstrated", "Module 1 (funding) and Module 2 (archive) on the same backend and database"],
  ], [4200, 5160]),
  ...shot("s13-api-tests.png", "Figure 14 — API test transcript: all checks passed (login, 401s, 403s, validation, SQL-injection attempts).", 560),
  p("Unauthenticated call from the browser:", { bold: true }),
  code(fs.readFileSync(path.join(DIR, "unauth.txt"), "utf8").trim().replace(/^/, "GET /api/funding (no token) → ")),

  h1("8. API Endpoints"),
  tbl(["Method", "Route", "Auth", "Purpose"], eps, [900, 2700, 2300, 3460]),

  h1("9. Individual Contributions"),
  tbl(["Member", "Module", "Backend work"], [
    ["Member 1 (fill in name)", "Module 1 — Submit Proposal & Funding", "Funding endpoints (POST/GET/PUT), validation, frontend integration"],
    ["Member 2 (fill in name)", "Module 2 — FYP Archive Browser", "Archive endpoints (GET/search/detail/POST), RBAC, frontend integration"],
  ], [2300, 3300, 3760]),

  h1("10. Submission Checklist"),
  b("Complete frontend and backend source code (GitHub repository: Waqas-Chohan/fypilot-prototype)."),
  b("Database setup script: backend/schema.sql (tables are also created and seeded automatically by app.py)."),
  b("API route list: Section 8."),
  b("Frontend–backend communication evidence: Figures 2–10."),
  b("Authentication / authorization testing evidence: Figures 11–14."),
  b("Live demonstration of both individual modules."),
  p("Notes: the demo runs locally (backend on localhost:5000). The Vercel deployment serves only the static frontend and cannot reach a local backend unless the backend is deployed and API_BASE/CORS are updated. Cloudflare Turnstile remains disabled for local testing (siteKey empty in login.js) and should be re-enabled for production."),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { font: "Arial", size: 44, bold: true, color: "0B1530" }, paragraph: { spacing: { before: 0, after: 160 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 30, bold: true, color: "1D4ED8" }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 25, bold: true, color: "0B1530" }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ] },
  numbering: { config: [{ reference: "bl", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } }, children: kids }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT); });
