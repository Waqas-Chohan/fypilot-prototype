"""Activity 6 - API test script. Run with the backend up:  python tests/test_api.py
Prints a transcript of each check (PASS/FAIL) covering Task 6 items 1-4 plus validation/RBAC."""
import json, sys, urllib.request, urllib.error

BASE = "http://localhost:5000/api"
fails = 0

def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def check(label, got, want, extra=""):
    global fails
    ok = got == want
    fails += (not ok)
    print(("PASS" if ok else "FAIL") + f"  {label}  -> HTTP {got} (expected {want}) {extra}")

print("=== 1. Login + JWT generation ===")
s, r = call("POST", "/auth/login", {"email": "w.saqib@student.nu.edu.pk", "password": "12345678"})
check("student login", s, 200, f"token={r.get('access_token','')[:28]}...")
stu = r["access_token"]
s, r = call("POST", "/auth/login", {"email": "tahir@faculty.nu.edu.pk", "password": "12345678"})
check("supervisor login", s, 200)
sup = r["access_token"]
s, r = call("POST", "/auth/login", {"email": "w.saqib@student.nu.edu.pk", "password": "wrong-pass"})
check("wrong password rejected", s, 401, r)

print("\n=== 2. Protected endpoint with valid token ===")
s, r = call("GET", "/auth/me", token=stu); check("GET /auth/me valid token", s, 200, r.get("user", {}).get("email"))

print("\n=== 3. Missing / invalid / tampered token ===")
s, r = call("GET", "/funding"); check("no token", s, 401, r)
s, r = call("GET", "/funding", token="not.a.jwt"); check("garbage token", s, 401, r)
tampered = stu[:-4] + ("AAAA" if not stu.endswith("AAAA") else "BBBB")
s, r = call("GET", "/funding", token=tampered); check("tampered signature", s, 401, r)

print("\n=== 4. Role-based access control ===")
s, r = call("POST", "/funding", {"title": "Dataset licence", "amount": 15000, "purpose": "Buy licensed dataset for model training"}, stu)
check("student submits funding (insert)", s, 201, r); fid = r.get("id")
s, r = call("PUT", f"/funding/{fid}", {"status": "Approved"}, stu); check("student tries to approve -> forbidden", s, 403, r)
s, r = call("PUT", f"/funding/{fid}", {"status": "Approved"}, sup); check("supervisor approves", s, 200, r)
s, r = call("POST", "/archive", {"title": "X", "year": 2024, "category": "ai", "supervisor": "Y", "summary": "Zzz"}, stu)
check("student tries to add archive -> forbidden", s, 403, r)
s, r = call("POST", "/archive", {"title": "Smart Attendance System", "year": 2024, "category": "ai", "supervisor": "Dr. Tahir", "similarity": "low", "summary": "Face-recognition attendance for lectures."}, sup)
check("supervisor adds archive entry", s, 201, r)
s, r = call("POST", "/auth/register", {"name": "Evil Admin", "email": "evil@student.nu.edu.pk", "password": "password123", "role": "supervisor"})
check("register ignores role=supervisor", s, 201, r.get("user"))
check("  ...registered role is student", r["user"]["role"], "student")

print("\n=== 5. Retrieval (data persisted in PostgreSQL) ===")
s, r = call("GET", "/funding", token=stu); check("student lists own funding", s, 200, f"{len(r['funding'])} row(s), status={r['funding'][0]['status']}")
s, r = call("GET", "/archive", token=stu); check("list archive", s, 200, f"{len(r['archive'])} project(s)")
s, r = call("GET", "/archive?search=attendance", token=stu); check("archive search", s, 200, f"{len(r['archive'])} match")
s, r = call("GET", "/dashboard/stats", token=stu); check("dashboard stats", s, 200, r)

print("\n=== 6. Server-side validation & injection safety ===")
s, r = call("POST", "/funding", {"title": "ab", "amount": 100, "purpose": "x"}, stu); check("too-short fields", s, 400, r)
s, r = call("POST", "/funding", {"title": "Valid title", "amount": -5, "purpose": "valid purpose"}, stu); check("negative amount", s, 400, r)
s, r = call("POST", "/funding", {"title": 123, "amount": "abc", "purpose": None}, stu); check("wrong JSON types (no 500)", s, 400, r)
s, r = call("POST", "/auth/login", {"email": "' OR '1'='1' --", "password": "x"}); check("SQL injection in login", s, 401, r)
s, r = call("GET", "/archive?search=%27%3B%20DROP%20TABLE%20users%3B%20--", token=stu); check("SQL injection in search (parameterized)", s, 200, f"{len(r['archive'])} match")
s, r = call("GET", "/auth/me", token=stu); check("users table still intact", s, 200)
s, r = call("GET", "/nope", token=stu); check("unknown route -> generic JSON", s, 404, r)
s, r = call("POST", "/auth/register", {"name": "Dup", "email": "w.saqib@student.nu.edu.pk", "password": "12345678"}); check("duplicate email", s, 409, r)

print("\nRESULT:", "ALL TESTS PASSED" if fails == 0 else f"{fails} FAILED")
sys.exit(1 if fails else 0)
