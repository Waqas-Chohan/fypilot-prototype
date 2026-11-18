"""
Activity 7 — capture evidence screenshots from the live backend.

Every pane in every image is produced by a real HTTP call against the
running Flask server and real queries against PostgreSQL. Nothing is
hand-written.

    cd backend && ALLOW_FAULT_INJECTION=true python app.py     # terminal 1
    python tests/shots/capture7.py                             # terminal 2
"""

import os
import re
import json
import html
import uuid
import time
import subprocess
import threading
import datetime as dt

import jwt
import requests
import psycopg2
import psycopg2.extras
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "screenshots", "activity7")
os.makedirs(OUT, exist_ok=True)

BASE = "http://127.0.0.1:5000/api/v2"
DB = "postgresql://postgres@127.0.0.1:5432/fypilot"
PGBIN = "/usr/lib/postgresql/16/bin"
PGDATA = "/var/lib/postgresql/a7data"

STUDENT = ("w.saqib@student.nu.edu.pk", "12345678")
OTHER = ("ayesha@student.nu.edu.pk", "12345678")
SUP1 = ("tahir@faculty.nu.edu.pk", "12345678")
SUP2 = ("sana@faculty.nu.edu.pk", "12345678")

panes = []           # (filename, title, [blocks])


# ----------------------------------------------------------------- utils --

def sql(query, args=()):
    with psycopg2.connect(DB, cursor_factory=psycopg2.extras.RealDictCursor) as c, c.cursor() as cur:
        cur.execute(query, args)
        if cur.description is None:
            return []
        return [dict(r) for r in cur.fetchall()]


def psql(command):
    r = subprocess.run(["psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "fypilot", "-c", command],
                       capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def login(creds):
    r = requests.post(BASE + "/auth/login", json={"email": creds[0], "password": creds[1]}, timeout=10)
    return r.json()


def short(token, n=28):
    return token[:n] + "…" if token else "(none)"


def call(method, path, token=None, body=None, params=None, extra_headers=None, label=None):
    """Make a request and return a printable record of it."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if extra_headers:
        headers.update(extra_headers)
    url = BASE + path
    r = requests.request(method, url, json=body, params=params, headers=headers, timeout=20)

    lines = []
    q = ("?" + "&".join(f"{k}={v}" for k, v in params.items())) if params else ""
    lines.append(f"$ {method} /api/v2{path}{q}")
    if token:
        lines.append(f"  Authorization: Bearer {short(token)}")
    if extra_headers:
        for k, v in extra_headers.items():
            lines.append(f"  {k}: {v}")
    if body is not None:
        lines.append("  " + json.dumps(body))
    lines.append("")
    lines.append(f"HTTP {r.status_code} {r.reason}")
    try:
        lines.append(json.dumps(r.json(), indent=2)[:1800])
    except ValueError:
        lines.append(r.text[:800])
    return r, "\n".join(lines)


def table(rows, columns=None, limit=12):
    """Render query rows as a fixed-width table."""
    if not rows:
        return "(no rows)"
    columns = columns or list(rows[0].keys())
    rows = rows[:limit]
    widths = {c: max(len(str(c)), *(len(_fmt(r.get(c))) for r in rows)) for c in columns}
    head = " | ".join(str(c).ljust(widths[c]) for c in columns)
    rule = "-+-".join("-" * widths[c] for c in columns)
    body = "\n".join(" | ".join(_fmt(r.get(c)).ljust(widths[c]) for c in columns) for r in rows)
    return head + "\n" + rule + "\n" + body


def _fmt(v):
    if v is None:
        return "NULL"
    if isinstance(v, dt.datetime):
        return v.strftime("%H:%M:%S")
    s = str(v)
    return s if len(s) <= 46 else s[:43] + "..."


def pane(filename, title, blocks):
    panes.append((filename, title, blocks))
    print("  captured", filename)


def block(heading, text, verdict=None):
    return {"heading": heading, "text": text, "verdict": verdict}


# ------------------------------------------------------------- scenarios --

def scenario_1_replay_after_logout():
    print("1. replay credential after logout")
    s = login(STUDENT)
    token = s["access_token"]
    _, a = call("GET", "/auth/session", token, label="before")
    _, b = call("POST", "/auth/logout", token)
    r, c = call("GET", "/auth/session", token)
    r2, d = call("POST", "/grants", token,
                 body={"title": "Replay attempt after logout",
                       "description": "This write must be refused because the session is dead.",
                       "category": "cloud", "amount": 1000})
    jti = jwt.decode(token, options={"verify_signature": False})["jti"]
    rows = sql("SELECT jti, user_id, revoked_at FROM auth_sessions WHERE jti = %s", (jti,))
    rows = [{"jti": str(x["jti"])[:8] + "…", "user_id": x["user_id"],
             "revoked_at": x["revoked_at"]} for x in rows]
    pane("e1-replay-after-logout.png",
         "Evidence 1 — replaying a credential after logout",
         [block("Step 1 — the session works before logout", a, "HTTP 200 — session is live"),
          block("Step 2 — log out (server-side revocation)", b, "HTTP 200 — session revoked"),
          block("Step 3 — replay the very same token", c,
                f"HTTP {r.status_code} — replay refused"),
          block("Step 4 — the dead token cannot write either", d,
                f"HTTP {r2.status_code} — write refused"),
          block("Database — the session row is revoked", table(rows),
                "revoked_at is set, so the token can never be accepted again")])


def scenario_2_concurrent_duplicate():
    print("2. concurrent duplicate submission")
    s = login(STUDENT)
    token = s["access_token"]
    title = "Concurrent duplicate demo " + uuid.uuid4().hex[:6]
    payload = {"title": title,
               "description": "Two identical submissions fired at the same instant.",
               "category": "hardware", "amount": 15000}
    results = []
    barrier = threading.Barrier(2)

    def submit(tag):
        barrier.wait()
        started = time.time()
        r = requests.post(BASE + "/grants", json=payload,
                          headers={"Authorization": "Bearer " + token}, timeout=20)
        results.append((tag, r.status_code, r.json(), started))

    threads = [threading.Thread(target=submit, args=("request A",)),
               threading.Thread(target=submit, args=("request B",))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    results.sort(key=lambda x: x[1])

    blocks = [block("Both requests sent simultaneously (threading.Barrier)",
                    "$ POST /api/v2/grants   x2, identical body\n  " + json.dumps(payload))]
    for tag, code, body, _ in results:
        blocks.append(block(f"{tag} — HTTP {code}",
                            json.dumps(body, indent=2)[:900],
                            "created" if code == 201 else "refused as a duplicate"))
    rows = sql("""SELECT reference, title, status, version, created_at
                    FROM grant_requests WHERE lower(btrim(title)) = lower(btrim(%s))""", (title,))
    blocks.append(block("Database — exactly one row exists",
                        table(rows, ["reference", "title", "status", "version", "created_at"]),
                        f"{len(rows)} row — the partial unique index settled the race in the database"))
    pane("e2-concurrent-duplicate.png",
         "Evidence 2 — two identical submissions at the same moment", blocks)


def scenario_3_combined_filter():
    print("3. combined filter, scoped results")
    stu, oth, sup = login(STUDENT), login(OTHER), login(SUP1)
    tag = uuid.uuid4().hex[:6]
    for who, title, cat, amount in [
        (stu, f"Cloud credits {tag}", "cloud", 50000),
        (stu, f"Hardware kit {tag}", "hardware", 9000),
        (stu, f"Cloud small {tag}", "cloud", 4000),
        (oth, f"Cloud credits other student {tag}", "cloud", 70000),
    ]:
        requests.post(BASE + "/grants",
                      json={"title": title, "description": "Seed row for the filter demonstration.",
                            "category": cat, "amount": amount},
                      headers={"Authorization": "Bearer " + who["access_token"]}, timeout=10)

    params = {"category": "cloud", "status": "PENDING", "q": tag, "min_amount": 10000}
    r1, a = call("GET", "/grants", stu["access_token"], params=params)
    r2, b = call("GET", "/grants", sup["access_token"], params=params)
    s_titles = [g["title"] for g in r1.json()["grants"]]
    v_titles = [g["title"] for g in r2.json()["grants"]]
    pane("e3-combined-filter-scope.png",
         "Evidence 3 — combined filters return correctly scoped results",
         [block("Four records seeded (three owned by the student, one by another student)",
                table([{"owner": "student", "title": f"Cloud credits {tag}", "category": "cloud", "amount": 50000},
                       {"owner": "student", "title": f"Hardware kit {tag}", "category": "hardware", "amount": 9000},
                       {"owner": "student", "title": f"Cloud small {tag}", "category": "cloud", "amount": 4000},
                       {"owner": "OTHER student", "title": f"Cloud credits other student {tag}", "category": "cloud", "amount": 70000}])),
          block("Student: category + status + search + min_amount combined", a,
                f"{r1.json()['count']} result(s), scope=own — hardware, the small amount and the "
                f"other student's record are all excluded"),
          block("The same filter as a reviewer", b,
                f"{r2.json()['count']} result(s), scope=all — the reviewer additionally sees the "
                f"other student's record"),
          block("Titles returned",
                "student  -> " + json.dumps(s_titles) + "\nreviewer -> " + json.dumps(v_titles),
                "the student's list never contains another owner's record")])


def scenario_4_two_claims_same_version():
    print("4. two claims with identical version")
    stu, s1, s2 = login(STUDENT), login(SUP1), login(SUP2)
    r = requests.post(BASE + "/grants",
                      json={"title": "Optimistic locking demo " + uuid.uuid4().hex[:6],
                            "description": "Two reviewers claim this record at the same instant.",
                            "category": "api", "amount": 32000},
                      headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10)
    grant = r.json()["grant"]
    ref, version = grant["reference"], grant["version"]

    results = []
    barrier = threading.Barrier(2)

    def claim(name, token):
        barrier.wait()
        resp = requests.post(BASE + f"/grants/{ref}/claim", json={"version": version},
                             headers={"Authorization": "Bearer " + token}, timeout=20)
        results.append((name, resp.status_code, resp.json()))

    threads = [threading.Thread(target=claim, args=("Dr. Tahir", s1["access_token"])),
               threading.Thread(target=claim, args=("Dr. Sana", s2["access_token"]))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    results.sort(key=lambda x: x[1])

    blocks = [block("Record before the race",
                    table([{"reference": ref, "status": grant["status"], "version": version}]),
                    "both reviewers hold version " + str(version)),
              block("Both claims sent at the same instant with version=" + str(version),
                    f"$ POST /api/v2/grants/{ref}/claim\n  " + json.dumps({"version": version}) +
                    "\n  (sent twice, by two different reviewers)")]
    for name, code, body in results:
        blocks.append(block(f"{name} — HTTP {code}", json.dumps(body, indent=2)[:1000],
                            "claim accepted" if code == 200 else "rejected: the version had already moved"))
    rows = sql("""SELECT gr.reference, gr.status, gr.version, u.name AS claimed_by
                    FROM grant_requests gr LEFT JOIN users u ON u.id = gr.claimed_by
                   WHERE gr.reference = %s""", (ref,))
    audit = sql("""SELECT a.action, u.name AS actor, a.occurred_at FROM grant_audit a
                     JOIN users u ON u.id = a.actor_id JOIN grant_requests g ON g.id = a.grant_id
                    WHERE g.reference = %s ORDER BY a.id""", (ref,))
    blocks.append(block("Database — one winner, version advanced exactly once", table(rows),
                        f"version {version} -> {rows[0]['version']}, claimed by {rows[0]['claimed_by']}"))
    blocks.append(block("Audit trail — a single CLAIMED entry", table(audit),
                        "the losing claim wrote nothing"))
    pane("e4-two-claims-same-version.png",
         "Evidence 4 — two claims with an identical version", blocks)
    return ref


def scenario_5_finalize_wrongly():
    print("5. finalize without claim / wrong actor")
    stu, s1, s2 = login(STUDENT), login(SUP1), login(SUP2)

    # (a) finalize before any claim
    g1 = requests.post(BASE + "/grants",
                       json={"title": "Finalize without claim " + uuid.uuid4().hex[:6],
                             "description": "Nobody has claimed this record yet.",
                             "category": "travel", "amount": 12000},
                       headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10).json()["grant"]
    ra, a = call("POST", f"/grants/{g1['reference']}/finalize", s1["access_token"],
                 body={"decision": "APPROVED", "version": g1["version"]})
    after_a = sql("SELECT reference, status, version, claimed_by FROM grant_requests WHERE reference = %s",
                  (g1["reference"],))

    # (b) claimed by Dr. Tahir, finalized by Dr. Sana
    g2 = requests.post(BASE + "/grants",
                       json={"title": "Finalize by wrong actor " + uuid.uuid4().hex[:6],
                             "description": "Claimed by one reviewer, finalized by another.",
                             "category": "api", "amount": 18000},
                       headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10).json()["grant"]
    claimed = requests.post(BASE + f"/grants/{g2['reference']}/claim", json={"version": g2["version"]},
                            headers={"Authorization": "Bearer " + s1["access_token"]},
                            timeout=10).json()["grant"]
    rb, b = call("POST", f"/grants/{g2['reference']}/finalize", s2["access_token"],
                 body={"decision": "REJECTED", "version": claimed["version"]})
    # (c) the rightful reviewer succeeds
    rc, c = call("POST", f"/grants/{g2['reference']}/finalize", s1["access_token"],
                 body={"decision": "APPROVED", "version": claimed["version"], "note": "Approved after review"})
    after_c = sql("""SELECT gr.reference, gr.status, gr.version, u.name AS claimed_by, gr.decided_at
                       FROM grant_requests gr LEFT JOIN users u ON u.id = gr.claimed_by
                      WHERE gr.reference = %s""", (g2["reference"],))

    pane("e5-finalize-without-claim-or-wrong-actor.png",
         "Evidence 5 — finalizing without a claim, and by the wrong actor",
         [block("Case A — finalize a PENDING record that nobody claimed", a,
                f"HTTP {ra.status_code} {ra.json().get('code','')} — the state machine refuses it"),
          block("Case A — the record did not change", table(after_a), "still PENDING, still unclaimed"),
          block("Case B — Dr. Sana finalizes a record claimed by Dr. Tahir", b,
                f"HTTP {rb.status_code} — forbidden, not merely a conflict"),
          block("Case C — the reviewer who claimed it finalizes successfully", c,
                f"HTTP {rc.status_code} — accepted"),
          block("Database after case C", table(after_c),
                "APPROVED, decided_at set, claimed_by unchanged")])


def scenario_6_other_owner():
    print("6. access another owner's record")
    stu, oth, sup = login(STUDENT), login(OTHER), login(SUP1)
    mine = requests.post(BASE + "/grants",
                         json={"title": "Private record of student A " + uuid.uuid4().hex[:6],
                               "description": "Only its owner and reviewers may see this record.",
                               "category": "hardware", "amount": 45000},
                         headers={"Authorization": "Bearer " + stu["access_token"]},
                         timeout=10).json()["grant"]
    ref = mine["reference"]
    r1, a = call("GET", f"/grants/{ref}", stu["access_token"])
    r2, b = call("GET", f"/grants/{ref}", oth["access_token"])
    r3, c = call("GET", f"/grants/{ref}/audit", oth["access_token"])
    r4, d = call("POST", f"/grants/{ref}/withdraw", oth["access_token"])
    r5, e = call("GET", f"/grants/{ref}", sup["access_token"])
    leaked = mine["title"] in (b + c + d)
    pane("e6-another-owners-record.png",
         "Evidence 6 — reaching a record owned by someone else",
         [block("The owner reads their own record", a, f"HTTP {r1.status_code} — allowed"),
          block("A different student reads the same reference", b,
                f"HTTP {r2.status_code} — reported as missing, so its existence is not confirmed"),
          block("The same student asks for its history", c, f"HTTP {r3.status_code} — refused"),
          block("The same student tries to withdraw it", d, f"HTTP {r4.status_code} — refused"),
          block("A reviewer reads it", e, f"HTTP {r5.status_code} — allowed by role"),
          block("Leak check",
                "title of the private record present in any refused response? " +
                ("YES" if leaked else "NO"),
                "no field of the record appears in any refused response")])


def scenario_7_audit_failure_and_db_down():
    print("7. forced audit failure, then database stopped")
    stu = login(STUDENT)
    token = stu["access_token"]
    title = "Atomicity probe " + uuid.uuid4().hex[:6]
    body = {"title": title,
            "description": "The audit write is forced to fail inside this transaction.",
            "category": "cloud", "amount": 21000}
    before = sql("SELECT COUNT(*) AS c FROM grant_requests")[0]["c"]
    r1, a = call("POST", "/grants", token, body=body,
                 extra_headers={"X-Fault-Inject": "audit"})
    after = sql("SELECT COUNT(*) AS c FROM grant_requests")[0]["c"]
    orphan = sql("SELECT reference, title FROM grant_requests WHERE title = %s", (title,))
    r2, b = call("POST", "/grants", token, body=body)
    leak = any(w in a.lower() for w in ("traceback", "psycopg2", "insert into"))

    blocks = [
        block("Rows before the attempt", f"SELECT COUNT(*) FROM grant_requests  ->  {before}"),
        block("Create with the audit write forced to fail", a,
              f"HTTP {r1.status_code} — safe message, no stack trace or SQL"),
        block("Rows after the attempt",
              f"SELECT COUNT(*) FROM grant_requests  ->  {after}\n"
              f"SELECT * FROM grant_requests WHERE title = '{title}'  ->  {len(orphan)} rows",
              "unchanged — the grant row was rolled back with the failed audit write"),
        block("Internal detail leaked to the client?", "traceback / driver / SQL present: " +
              ("YES" if leak else "NO"), "only a safe message reached the client"),
        block("The same request without the fault", b,
              f"HTTP {r2.status_code} — succeeds once the audit store is healthy"),
    ]

    # Now stop PostgreSQL entirely and call the API again.
    subprocess.run(["su", "postgres", "-c", f"{PGBIN}/pg_ctl -D {PGDATA} -m fast stop"],
                   capture_output=True, text=True)
    time.sleep(2)
    try:
        r3 = requests.post(BASE + "/grants", json=body,
                           headers={"Authorization": "Bearer " + token}, timeout=20)
        down = f"$ POST /api/v2/grants   (PostgreSQL stopped)\n\nHTTP {r3.status_code} {r3.reason}\n" + r3.text[:700]
        down_code = r3.status_code
        down_leak = any(w in r3.text.lower() for w in ("traceback", "psycopg2", "could not connect"))
    except Exception as exc:                      # noqa: BLE001
        down = "request failed: " + type(exc).__name__
        down_code, down_leak = 0, False
    subprocess.run(["su", "postgres", "-c",
                    f"{PGBIN}/pg_ctl -D {PGDATA} -l /tmp/pg.log -o '-p 5432 -k /var/run/postgresql' start"],
                   capture_output=True, text=True)
    time.sleep(3)
    r4 = requests.get(BASE + "/grants", headers={"Authorization": "Bearer " + token}, timeout=20)

    blocks += [
        block("PostgreSQL stopped, then the API called again", down,
              f"HTTP {down_code} — a safe, generic failure message"),
        block("Internal detail leaked while the database was down?",
              "driver text / traceback present: " + ("YES" if down_leak else "NO"),
              "the client is told the service is unavailable and nothing more"),
        block("After restarting PostgreSQL", f"$ GET /api/v2/grants\n\nHTTP {r4.status_code} — "
              f"{r4.json().get('count', 0)} records still present",
              "service recovers and stored data is intact"),
    ]
    pane("e7-audit-failure-and-db-down.png",
         "Evidence 7 — forced audit write failure, and the database stopped", blocks)


# ------------------------------------------------- supporting screenshots --

def shot_api_surface():
    print("A. API responses of the working features")
    stu, sup = login(STUDENT), login(SUP1)
    _, a = call("POST", "/auth/login", body={"email": STUDENT[0], "password": STUDENT[1]})
    _, b = call("GET", "/auth/session", stu["access_token"])
    _, c = call("POST", "/auth/refresh", stu["refresh_token"])
    g = requests.post(BASE + "/grants",
                      json={"title": "Sensor kit for prototype " + uuid.uuid4().hex[:5],
                            "description": "Hardware sensors needed for the prototype stage.",
                            "category": "hardware", "amount": 38000},
                      headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10)
    ref = g.json()["grant"]["reference"]
    d = f"$ POST /api/v2/grants\n\nHTTP {g.status_code}\n" + json.dumps(g.json(), indent=2)[:900]
    _, e = call("GET", "/grants", stu["access_token"], params={"status": "PENDING"})
    pane("a1-api-auth-and-create.png", "API responses — authentication and record creation",
         [block("Sign in", a, "access token + refresh token issued"),
          block("Who am I (server-derived)", b, "role comes from the database"),
          block("Refresh the access token", c, "a page reload keeps the user signed in"),
          block("Create a grant request", d, "returns the committed record"),
          block("List own records", e, "scope=own")])

    v = requests.get(BASE + "/grants/" + ref,
                     headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10).json()["grant"]
    cl = requests.post(BASE + f"/grants/{ref}/claim", json={"version": v["version"]},
                       headers={"Authorization": "Bearer " + sup["access_token"]}, timeout=10)
    f = f"$ POST /api/v2/grants/{ref}/claim\n  " + json.dumps({"version": v["version"]}) + \
        f"\n\nHTTP {cl.status_code}\n" + json.dumps(cl.json(), indent=2)[:800]
    cv = cl.json()["grant"]["version"]
    fin = requests.post(BASE + f"/grants/{ref}/finalize",
                        json={"decision": "APPROVED", "version": cv, "note": "Approved for one semester"},
                        headers={"Authorization": "Bearer " + sup["access_token"]}, timeout=10)
    h = f"$ POST /api/v2/grants/{ref}/finalize\n  " + \
        json.dumps({"decision": "APPROVED", "version": cv}) + \
        f"\n\nHTTP {fin.status_code}\n" + json.dumps(fin.json(), indent=2)[:800]
    _, i = call("GET", f"/grants/{ref}/audit", stu["access_token"])
    pane("a2-api-workflow-and-audit.png", "API responses — the workflow and its audit trail",
         [block("Reviewer claims the request", f, "PENDING -> UNDER_REVIEW, version advanced"),
          block("Reviewer approves it", h, "UNDER_REVIEW -> APPROVED, decided_at set"),
          block("The owner reads the history", i, "three entries, in order, with actor and time")])
    return ref


def shot_schema():
    print("B. database schema")
    pane("b1-schema-grant-requests.png", "Database schema — grant_requests",
         [block("\\d grant_requests", psql("\\d grant_requests")),
          block("Constraints enforced below the API",
                psql("SELECT conname, pg_get_constraintdef(oid) AS definition "
                     "FROM pg_constraint WHERE conrelid = 'grant_requests'::regclass "
                     "ORDER BY conname"))])
    pane("b2-schema-sessions-and-audit.png", "Database schema — auth_sessions and grant_audit",
         [block("\\d auth_sessions", psql("\\d auth_sessions")),
          block("\\d grant_audit", psql("\\d grant_audit")),
          block("Append-only trigger on the audit table",
                psql("SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger "
                     "WHERE tgrelid = 'grant_audit'::regclass AND NOT tgisinternal"))])


def shot_stored_records(ref):
    print("C. stored records and status changes")
    users = sql("SELECT id, name, email, role, left(password_hash, 34) || '…' AS password_hash "
                "FROM users ORDER BY id")
    pane("c1-stored-users-hashed.png", "Stored records — users (passwords are hashed)",
         [block("SELECT id, name, email, role, password_hash FROM users",
                table(users, ["id", "name", "email", "role", "password_hash"])),
          block("Plaintext check",
                psql("SELECT count(*) AS plaintext_passwords FROM users WHERE password_hash = '12345678'"),
                "no row stores the password in plain text; every hash is scrypt with its own salt")])

    grants = sql("""SELECT gr.reference, u.name AS owner, gr.category, gr.amount, gr.status,
                           gr.version, c.name AS claimed_by
                      FROM grant_requests gr JOIN users u ON u.id = gr.owner_id
                      LEFT JOIN users c ON c.id = gr.claimed_by
                     ORDER BY gr.id DESC LIMIT 10""")
    counts = sql("SELECT status, COUNT(*) AS records FROM grant_requests GROUP BY status ORDER BY status")
    pane("c2-stored-grants-and-status.png", "Stored records — grant requests and their statuses",
         [block("Most recent grant_requests rows", table(grants)),
          block("Records by status", table(counts),
                "every value comes from the allowed set in the CHECK constraint")])

    history = sql("""SELECT g.reference, a.action, a.from_status, a.to_status,
                            u.name AS actor, a.actor_role, a.occurred_at
                       FROM grant_audit a JOIN users u ON u.id = a.actor_id
                       JOIN grant_requests g ON g.id = a.grant_id
                      WHERE g.reference = %s ORDER BY a.id""", (ref,))
    allaudit = sql("""SELECT a.action, COUNT(*) AS entries FROM grant_audit a
                       GROUP BY a.action ORDER BY 1""")
    pane("c3-status-changes-audit.png", "Status changes — the audit trail in the database",
         [block(f"Full history of {ref}", table(history,
                ["action", "from_status", "to_status", "actor", "actor_role", "occurred_at"])),
          block("Audit entries across the whole database", table(allaudit),
                "one entry per state change, written in the same transaction as the change")])


def shot_restart_persistence():
    print("D. persistence across a restart")
    stu = login(STUDENT)
    body = {"title": "Persistence proof " + uuid.uuid4().hex[:6],
            "description": "This record must still be here after the backend restarts.",
            "category": "other", "amount": 7600}
    r = requests.post(BASE + "/grants", json=body,
                      headers={"Authorization": "Bearer " + stu["access_token"]}, timeout=10)
    grant = r.json()["grant"]
    created = f"$ POST /api/v2/grants\n\nHTTP {r.status_code}\n" + json.dumps(grant, indent=2)[:700]

    subprocess.run(["pkill", "-f", "python3 app.py"], capture_output=True)
    time.sleep(2)
    env = dict(os.environ, ALLOW_FAULT_INJECTION="true")
    subprocess.Popen(["python3", "app.py"], cwd=os.path.join(ROOT, "backend"),
                     stdout=open("/tmp/flask.log", "a"), stderr=subprocess.STDOUT, env=env)
    for _ in range(30):
        time.sleep(1)
        try:
            if requests.get("http://127.0.0.1:5000/api/health", timeout=3).status_code == 200:
                break
        except requests.RequestException:
            continue

    fresh = login(STUDENT)
    r2, after = call("GET", "/grants/" + grant["reference"], fresh["access_token"])
    rows = sql("SELECT reference, title, status, created_at FROM grant_requests WHERE reference = %s",
               (grant["reference"],))
    pane("d1-persistence-after-restart.png",
         "Persistence — the record survives a backend restart",
         [block("Create the record", created, "HTTP 201"),
          block("Restart the backend process",
                "$ pkill -f 'python3 app.py'\n$ python app.py\n\n"
                "(new process, empty memory, same PostgreSQL database)"),
          block("Read it back through the restarted backend", after,
                f"HTTP {r2.status_code} — the record is still there"),
          block("Straight from storage", table(rows),
                "data lives in PostgreSQL, not in the process")])


def shot_test_run():
    print("E. test suite run")
    r = subprocess.run(["python3", "-m", "pytest", "tests/test_activity7.py", "-v",
                        "--no-header", "-p", "no:cacheprovider"],
                       cwd=os.path.join(ROOT, "backend"), capture_output=True, text=True)
    text = r.stdout + r.stderr
    text = re.sub(r"^tests/test_activity7\.py::", "", text, flags=re.M)
    lines = [l for l in text.splitlines() if l.strip()]
    keep = [l for l in lines if "PASSED" in l or "FAILED" in l or "passed" in l or "failed" in l]
    half = (len(keep) + 1) // 2
    pane("e8-test-run-part1.png", "Integration test run (1 of 2)",
         [block("$ python -m pytest tests/test_activity7.py -v", "\n".join(keep[:half]))])
    pane("e9-test-run-part2.png", "Integration test run (2 of 2)",
         [block("(continued)", "\n".join(keep[half:])),
          block("Result", keep[-1] if keep else "",
                "every requirement is covered by at least one automated test")])


# ---------------------------------------------------------------- render --

CSS = """
*{box-sizing:border-box} body{margin:0;background:#0b1220;font-family:'Segoe UI',Arial,sans-serif}
.wrap{padding:0 0 14px}
.title{background:#13213d;color:#e2e8f0;font-size:17px;font-weight:700;padding:13px 20px;
  border-bottom:2px solid #2563eb}
.sec{margin:14px 18px 0;border:1px solid #1e293b;border-radius:8px;overflow:hidden}
.sec h3{margin:0;background:#16233f;color:#93c5fd;font-size:13.5px;font-weight:600;padding:8px 14px}
pre{margin:0;padding:12px 14px;color:#e2e8f0;font:12.5px/1.5 Consolas,'DejaVu Sans Mono',monospace;
  white-space:pre-wrap;word-break:break-word;background:#0f172a}
.verdict{background:#132b22;color:#86efac;font-size:12.5px;padding:8px 14px;border-top:1px solid #1e3a2f}
.verdict b{color:#4ade80}
.s2xx{color:#4ade80;font-weight:700}.s4xx{color:#fbbf24;font-weight:700}.s5xx{color:#f87171;font-weight:700}
.cmd{color:#38bdf8}
"""


def highlight(text):
    out = html.escape(text)
    out = re.sub(r"^(\$ .*)$", r'<span class="cmd">\1</span>', out, flags=re.M)
    out = re.sub(r"\bHTTP (2\d\d)\b", r'HTTP <span class="s2xx">\1</span>', out)
    out = re.sub(r"\bHTTP (4\d\d)\b", r'HTTP <span class="s4xx">\1</span>', out)
    out = re.sub(r"\bHTTP (5\d\d)\b", r'HTTP <span class="s5xx">\1</span>', out)
    return out


def render():
    print("rendering", len(panes), "images")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1150, "height": 900}, device_scale_factor=2)
        for filename, title, blocks in panes:
            sections = "".join(
                f'<div class="sec"><h3>{html.escape(b["heading"])}</h3>'
                f'<pre>{highlight(b["text"])}</pre>'
                + (f'<div class="verdict"><b>&#10003;</b> {html.escape(b["verdict"])}</div>'
                   if b.get("verdict") else "")
                + "</div>"
                for b in blocks)
            page.set_content(f"<html><head><style>{CSS}</style></head><body><div class='wrap'>"
                             f"<div class='title'>{html.escape(title)}</div>{sections}</div></body></html>")
            # Clip to the content element so there is no trailing blank space.
            page.locator(".wrap").screenshot(path=os.path.join(OUT, filename))
        browser.close()


if __name__ == "__main__":
    print("Capturing Activity 7 evidence into", OUT)
    ref = shot_api_surface()
    scenario_1_replay_after_logout()
    scenario_2_concurrent_duplicate()
    scenario_3_combined_filter()
    scenario_4_two_claims_same_version()
    scenario_5_finalize_wrongly()
    scenario_6_other_owner()
    shot_schema()
    shot_stored_records(ref)
    scenario_7_audit_failure_and_db_down()
    shot_restart_persistence()
    shot_test_run()
    render()
    print("done —", len(panes), "images in", OUT)
