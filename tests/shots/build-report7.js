/* Activity 7 — build ACTIVITY_7_REPORT.docx from the captured screenshots.
   Run after tests/shots/capture7.py:  node tests/shots/build-report7.js        */
const fs = require("fs"), path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, PageBreak,
} = require("/opt/npm-tools/node_modules/docx");

const ROOT = path.join(__dirname, "..", "..");
const DIR = path.join(ROOT, "screenshots", "activity7");
const OUT = path.join(ROOT, "ACTIVITY_7_REPORT.docx");

let figure = 0;

function png(file, maxW = 600) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const maxH = 760;
  let k = maxW / w;
  if (h * k > maxH) k = maxH / h;
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, keepNext: true,
    children: [new ImageRun({ type: "png", data: buf,
      transformation: { width: Math.round(w * k), height: Math.round(h * k) } })],
  });
}

const cap = (t) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: t, italics: true, size: 19, color: "555555" })],
});
const shot = (file, caption, w) => { figure += 1; return [png(file, w), cap(`Figure ${figure} — ${caption}`)]; };

const h1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 120 } });
const h2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
const p = (t, o = {}) => new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: t, ...o })] });
const b = (t) => new Paragraph({ text: t, numbering: { reference: "bl", level: 0 }, spacing: { after: 60 } });
const code = (t) => new Paragraph({
  spacing: { after: 50 }, shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
  children: [new TextRun({ text: t, font: "Consolas", size: 18 })],
});
const brk = () => new Paragraph({ children: [new PageBreak()] });

function tbl(head, rows, widths) {
  const total = widths.reduce((a, c) => a + c, 0);
  const mk = (t, w, hd) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: hd ? { type: ShadingType.CLEAR, fill: "0B1530" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: hd, color: hd ? "FFFFFF" : "000000", size: 18 })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((t, i) => mk(t, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => mk(t, widths[i], false)) })),
    ],
  });
}

const kids = [
  new Paragraph({ text: "FYPilot — Activity 7", heading: HeadingLevel.TITLE }),
  p("Secure Workflow, Authorization, Concurrency and Auditing", { bold: true, size: 26 }),
  p("Secure Software Development · Development Activity 7 · FAST NUCES Chiniot-Faisalabad"),
  p("Project: FYPilot — Intelligent Final Year Project Lifecycle Management Platform"),
  p("Stack: Python Flask (blueprint) · PostgreSQL 16 · JWT with server-side sessions · Werkzeug scrypt password hashing · pytest integration tests"),
  p("Feature under test: the Project Grant request workflow — a student submits a funding request, a reviewer claims it, and the reviewer who claimed it finalizes it. Every step is recorded in an append-only audit trail."),

  h1("1. What Was Built"),
  p("Activity 6 connected the FYPilot frontend to a Flask and PostgreSQL backend. Activity 7 adds a secure, concurrent, auditable workflow on top of that same backend. The new code is a Flask blueprint mounted at /api/v2 so the Activity 6 endpoints keep working unchanged."),
  tbl(["Requirement", "Where it is implemented", "Evidence"], [
    ["Hashed passwords, server-validated sessions, expiry and refresh", "workflow.py — issue_session, resolve_identity; auth_sessions table", "Figures 1, 5, 8"],
    ["Reusable authorization guards; role from trusted server data", "workflow.py — @authenticated, @require_role", "Figures 1, 13, 17"],
    ["Session invalidation on logout; replay fails", "workflow.py — /auth/logout sets revoked_at", "Figure 8"],
    ["401 vs 403 distinction; safe error bodies", "workflow.py — _unauthenticated, _forbidden, err", "Figures 12, 13, 14"],
    ["Schema, validation, race-safe duplicate prevention", "schema_activity7.sql CHECK constraints + partial unique index; validate_grant_payload", "Figures 3, 9"],
    ["Atomic creation of record plus audit entry", "workflow.py — Tx context manager, write_audit", "Figure 14"],
    ["Response returns the committed record; persistence after restart", "create_grant reads the row back; restart test", "Figures 1, 15"],
    ["Database-driven retrieval with combined filters", "workflow.py — list_grants", "Figure 10"],
    ["State machine and concurrent updates", "TRANSITIONS table; version-guarded UPDATE", "Figures 2, 11, 12"],
    ["Atomic audit history and privacy", "grant_audit + append-only trigger", "Figures 7, 13"],
    ["Robust API and integration tests", "backend/tests/test_activity7.py — 57 tests", "Figures 16, 17"],
  ], [3000, 3800, 1560]),

  h1("2. How to Run It"),
  code("cd backend && pip install -r requirements.txt"),
  code("psql -U postgres -c \"CREATE DATABASE fypilot\""),
  code("# backend/.env : DATABASE_URL, JWT_SECRET_KEY, ALLOW_FAULT_INJECTION=true (tests only)"),
  code("python app.py                                  # creates tables, seeds demo users"),
  code("python -m pytest tests/test_activity7.py -v    # 57 integration tests"),
  code("python tests/shots/capture7.py                 # regenerates every screenshot below"),
  p("Demo accounts (all with password 12345678): w.saqib@student.nu.edu.pk and ayesha@student.nu.edu.pk are students; tahir@faculty.nu.edu.pk and sana@faculty.nu.edu.pk are supervisors; coordinator@nu.edu.pk is the coordinator."),
  p("Every screenshot in this report was produced by tests/shots/capture7.py from real HTTP calls against the running server and real queries against PostgreSQL. Nothing is mocked or hand-written.", { italics: true }),

  brk(),
  h1("3. API Responses — the Working Features"),
  p("The whole feature set, called end to end. Identity comes from the session, the record is created as PENDING, a reviewer claims it, and the reviewer who claimed it approves it."),
  ...shot("a1-api-auth-and-create.png", "Sign in, session check, token refresh, record creation and the owner-scoped list.", 540),
  ...shot("a2-api-workflow-and-audit.png", "Claim, approve, and the resulting audit trail read by the owner.", 560),

  brk(),
  h1("4. Database Schema"),
  p("Validation is enforced in two places: in the API and again in the database, so an invalid row cannot be written even by a client with a direct database connection."),
  ...shot("b1-schema-grant-requests.png", "grant_requests — columns, CHECK constraints and the partial unique index that prevents duplicates.", 560),
  ...shot("b2-schema-sessions-and-audit.png", "auth_sessions and grant_audit, with the trigger that makes the audit trail append-only.", 560),
  p("Key points in the schema:", { bold: true }),
  b("owner_id is a foreign key to users; a record always belongs to exactly one owner."),
  b("reference is a unique, non-guessable public identifier, so internal row ids are never exposed."),
  b("status is limited by a CHECK constraint to PENDING, UNDER_REVIEW, APPROVED, REJECTED or WITHDRAWN."),
  b("Title and description minimum lengths are CHECK constraints on the trimmed value."),
  b("version supports optimistic locking; created_at and updated_at are set by the database."),
  b("A partial unique index on (owner_id, lower(btrim(title))) for open records makes duplicate prevention race-safe."),

  brk(),
  h1("5. Stored Records and Status Changes"),
  ...shot("c1-stored-users-hashed.png", "The users table. Every password is a salted scrypt hash; no row holds plaintext.", 580),
  ...shot("c2-stored-grants-and-status.png", "Stored grant requests and the count of records in each status.", 580),
  ...shot("c3-status-changes-audit.png", "The audit trail: one entry per state change, with actor, role, old status, new status and time.", 580),

  brk(),
  h1("6. Required Test Evidence"),
  p("The seven scenarios named in the brief, each captured from a live run."),

  h2("6.1 Replaying a credential after logout"),
  p("The token works, the user logs out, and the identical token is then replayed — for a read and for a write. Both are refused, and the session row shows revoked_at set."),
  ...shot("e1-replay-after-logout.png", "A logged-out token is dead for reads and for writes.", 540),

  h2("6.2 Concurrent duplicate submission"),
  p("Two identical submissions are fired at the same instant using a thread barrier. One is created, the other is refused, and exactly one row exists afterwards. The decision is made by the database index, not by a read-then-write check that a race could slip past."),
  ...shot("e2-concurrent-duplicate.png", "One HTTP 201 and one HTTP 409; a single row in the database.", 540),

  h2("6.3 Combined filters return correctly scoped results"),
  p("Four records are seeded, three owned by the signed-in student and one by a different student. Category, status, search text and a minimum amount are applied together."),
  ...shot("e3-combined-filter-scope.png", "The student's results are filtered and scoped to their own records; the reviewer sees more.", 540),

  h2("6.4 Two claims with an identical version"),
  p("Two reviewers claim the same PENDING record at the same instant, both holding version 1. The conditional UPDATE matches for only one of them."),
  ...shot("e4-two-claims-same-version.png", "One claim succeeds, the other receives VERSION_CONFLICT; the version advances exactly once.", 540),

  h2("6.5 Finalizing without a claim, or by the wrong actor"),
  p("Three cases: finalizing a record nobody has claimed, finalizing a record claimed by a different reviewer, and the rightful reviewer finalizing successfully. The first two change nothing."),
  ...shot("e5-finalize-without-claim-or-wrong-actor.png", "409 NOT_CLAIMED, then 403 for the wrong reviewer, then 200 for the right one.", 540),

  h2("6.6 Reaching another owner's record"),
  p("A second student uses the exact reference of a record they do not own. Read, history and withdraw are all refused with 404 rather than 403, so the API never confirms that the record exists. A reviewer, whose role permits it, can read the same record."),
  ...shot("e6-another-owners-record.png", "Cross-owner access is refused and no field of the private record appears in any response.", 540),

  h2("6.7 Forcing an audit write failure, and stopping the database"),
  p("First the audit write is forced to fail inside the create transaction: the response is a safe 503 and the row count is unchanged, proving the grant row was rolled back with it. Then PostgreSQL is stopped entirely and the API is called again; the client gets a generic unavailable message with no driver text. After PostgreSQL restarts, the stored data is intact."),
  ...shot("e7-audit-failure-and-db-down.png", "Neither write persists when the audit entry fails, and a stopped database produces a safe error.", 520),

  brk(),
  h1("7. Persistence After a Restart"),
  p("A record is created, the Flask process is killed and started again, and the record is read back through the new process. The data lives in PostgreSQL, not in application memory."),
  ...shot("d1-persistence-after-restart.png", "The record is still present after the backend restarts with empty memory.", 540),

  brk(),
  h1("8. Integration Test Run"),
  p("57 integration tests run against the live server and the live database. They cover all eleven requirement groups, including the seven scenarios above."),
  ...shot("e8-test-run-part1.png", "pytest output, part 1.", 560),
  ...shot("e9-test-run-part2.png", "pytest output, part 2 — 57 passed.", 560),

  h1("9. Design Decisions Worth Noting"),
  h2("Why a session table and not a plain JWT"),
  p("A signed token alone cannot be withdrawn before it expires, so logout would be cosmetic. Each token carries a jti that must match a live row in auth_sessions, and logout sets revoked_at on that row. The replayed token in section 6.1 is cryptographically valid and still refused."),
  h2("Why the role is never read from the token"),
  p("resolve_identity uses the token only to find the session, then reads the user's role from the users table. Section 6 includes a test that rewrites the token payload to claim the supervisor role; it is signed correctly and still refused, because the payload is never consulted for authorization."),
  h2("Why cross-owner access answers 404 and not 403"),
  p("A 403 confirms that the record exists, which leaks information to anyone who can guess or enumerate a reference. Returning 404 keeps the existence of other students' records private. 403 is still used where the caller is legitimately allowed to know the record exists but may not perform the action — for example, the wrong reviewer trying to finalize in section 6.5."),
  h2("Why optimistic locking rather than a lock held across the request"),
  p("Reviewers read a record and act on it seconds or minutes later. Holding a database lock for that long would block other work. Instead the client sends the version it saw and the UPDATE only applies if the row is still at that version, so a stale decision is rejected instead of silently overwriting someone else's."),
  h2("Fault injection"),
  p("The forced audit failure in section 6.7 is triggered by the X-Fault-Inject header, which the server honours only when ALLOW_FAULT_INJECTION is set to true. It is off by default and must never be enabled in production; it exists so that the atomicity guarantee can be demonstrated rather than merely asserted."),
];

const doc = new Document({
  numbering: { config: [{ reference: "bl", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 220 } } } }] }] },
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal",
        run: { size: 44, bold: true, color: "0B1530", font: "Calibri" },
        paragraph: { spacing: { after: 120 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 30, bold: true, color: "1C4E63", font: "Arial" } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 25, bold: true, color: "1C4E63", font: "Arial" } },
    ],
  },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: kids }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, (buf.length / 1024 / 1024).toFixed(2) + " MB,", figure, "figures");
});
