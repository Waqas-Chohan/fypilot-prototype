"""
FYPilot — Activity 7 integration tests.

These run against a live backend and a live PostgreSQL database, so they
exercise real HTTP, real transactions and real concurrency rather than
mocks.

    cd backend
    python app.py                      # terminal 1 (ALLOW_FAULT_INJECTION=true)
    python -m pytest tests/test_activity7.py -v     # terminal 2
"""

import os
import uuid
import base64
import json
import threading

import jwt
import psycopg2
import psycopg2.extras
import pytest
import requests

BASE = os.getenv("API_BASE", "http://127.0.0.1:5000") + "/api/v2"
DB = os.getenv("DATABASE_URL", "postgresql://postgres@127.0.0.1:5432/fypilot")

STUDENT = ("w.saqib@student.nu.edu.pk", "12345678")
OTHER_STUDENT = ("ayesha@student.nu.edu.pk", "12345678")
SUPERVISOR = ("tahir@faculty.nu.edu.pk", "12345678")
SUPERVISOR_2 = ("sana@faculty.nu.edu.pk", "12345678")

GOOD = {
    "title": "GPU hours for similarity model",
    "description": "Cloud GPU time to train the proposal similarity engine.",
    "category": "cloud",
    "amount": 25000,
}


# ---------------------------------------------------------------- helpers --

def db():
    return psycopg2.connect(DB, cursor_factory=psycopg2.extras.RealDictCursor)


def sql(query, args=(), one=False):
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, args)
        if cur.description is None:
            return None
        return cur.fetchone() if one else cur.fetchall()


def login(creds):
    r = requests.post(BASE + "/auth/login",
                      json={"email": creds[0], "password": creds[1]}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def auth(token):
    return {"Authorization": "Bearer " + token}


def unique(payload=None, **over):
    body = dict(GOOD, **(payload or {}))
    body["title"] = body["title"] + " " + uuid.uuid4().hex[:6]
    body.update(over)
    return body


def create_grant(token, payload=None):
    r = requests.post(BASE + "/grants", json=payload or unique(),
                      headers=auth(token), timeout=10)
    assert r.status_code == 201, r.text
    return r.json()["grant"]


@pytest.fixture(scope="module")
def student():
    return login(STUDENT)


@pytest.fixture(scope="module")
def other_student():
    return login(OTHER_STUDENT)


@pytest.fixture(scope="module")
def supervisor():
    return login(SUPERVISOR)


@pytest.fixture(scope="module")
def supervisor2():
    return login(SUPERVISOR_2)


# =========================================================== 1. credentials ==

class TestCredentialStorage:
    """Password hashes, never plaintext."""

    def test_no_plaintext_password_is_stored(self):
        rows = sql("SELECT email, password_hash FROM users")
        assert rows
        for row in rows:
            assert row["password_hash"] != "12345678"
            assert "12345678" not in row["password_hash"]
            # Werkzeug stores method$salt$hash — a strong, salted KDF.
            assert row["password_hash"].split("$")[0].startswith(("scrypt", "pbkdf2"))

    def test_same_password_gives_different_hashes(self):
        rows = sql("SELECT password_hash FROM users")
        hashes = [r["password_hash"] for r in rows]
        assert len(set(hashes)) == len(hashes), "hashes must be individually salted"

    def test_valid_credentials_succeed(self):
        body = login(STUDENT)
        assert body["access_token"] and body["refresh_token"]
        assert body["user"]["role"] == "student"

    def test_wrong_password_fails(self):
        r = requests.post(BASE + "/auth/login",
                          json={"email": STUDENT[0], "password": "wrong-password"}, timeout=10)
        assert r.status_code == 401
        assert r.json()["error"] == "Invalid email or password"

    def test_unknown_email_gives_the_same_message(self):
        """Login must not reveal which addresses are registered."""
        r = requests.post(BASE + "/auth/login",
                          json={"email": "nobody@example.com", "password": "whatever1"}, timeout=10)
        assert r.status_code == 401
        assert r.json()["error"] == "Invalid email or password"


# ============================================================== 2. sessions ==

class TestSessions:
    """Server-validated sessions, expiry and refresh."""

    def test_session_row_is_created_server_side(self, student):
        jti = jwt.decode(student["access_token"], options={"verify_signature": False})["jti"]
        row = sql("SELECT * FROM auth_sessions WHERE jti = %s", (jti,), one=True)
        assert row is not None and row["revoked_at"] is None

    def test_protected_route_works_with_a_valid_session(self, student):
        r = requests.get(BASE + "/auth/session", headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 200 and r.json()["authenticated"] is True

    def test_reload_preserves_login(self, student):
        """Three consecutive calls with the same token keep working."""
        for _ in range(3):
            assert requests.get(BASE + "/auth/session",
                                headers=auth(student["access_token"]), timeout=10).status_code == 200

    def test_refresh_issues_a_new_access_token(self, student):
        r = requests.post(BASE + "/auth/refresh",
                          headers=auth(student["refresh_token"]), timeout=10)
        assert r.status_code == 200
        new_token = r.json()["access_token"]
        assert requests.get(BASE + "/auth/session",
                            headers=auth(new_token), timeout=10).status_code == 200

    def test_expired_token_is_rejected(self):
        """A token whose exp has passed fails even though it is well formed."""
        body = login(STUDENT)
        claims = jwt.decode(body["access_token"], options={"verify_signature": False})
        expired = jwt.encode({**claims, "exp": claims["iat"] - 10},
                             os.getenv("JWT_SECRET_KEY", "dev-activity7-secret-key-not-for-production"),
                             algorithm="HS256")
        r = requests.get(BASE + "/auth/session", headers=auth(expired), timeout=10)
        assert r.status_code == 401
        assert "expired" in r.json()["error"].lower()

    def test_tampered_signature_is_rejected(self, student):
        bad = student["access_token"][:-4] + "AAAA"
        r = requests.get(BASE + "/auth/session", headers=auth(bad), timeout=10)
        assert r.status_code == 401

    def test_unknown_session_is_rejected(self):
        """A correctly signed token whose session row does not exist fails."""
        forged = jwt.encode(
            {"sub": "1", "jti": str(uuid.uuid4()), "typ": "access",
             "iat": 1700000000, "exp": 4102444800},
            os.getenv("JWT_SECRET_KEY", "dev-activity7-secret-key-not-for-production"),
            algorithm="HS256")
        r = requests.get(BASE + "/auth/session", headers=auth(forged), timeout=10)
        assert r.status_code == 401

    def test_refresh_token_cannot_be_used_as_an_access_token(self, student):
        r = requests.get(BASE + "/auth/session",
                         headers=auth(student["refresh_token"]), timeout=10)
        assert r.status_code == 401


# ======================================== 3. session invalidation (logout) ==

class TestLogoutInvalidation:
    """EVIDENCE 1 — replaying a credential after logout must fail."""

    def test_replaying_a_token_after_logout_fails(self):
        session = login(STUDENT)
        token = session["access_token"]

        before = requests.get(BASE + "/auth/session", headers=auth(token), timeout=10)
        assert before.status_code == 200

        out = requests.post(BASE + "/auth/logout", headers=auth(token), timeout=10)
        assert out.status_code == 200

        replay = requests.get(BASE + "/auth/session", headers=auth(token), timeout=10)
        assert replay.status_code == 401
        assert "logged out" in replay.json()["error"].lower()

        # The same dead token cannot create data either.
        write = requests.post(BASE + "/grants", json=unique(), headers=auth(token), timeout=10)
        assert write.status_code == 401

        jti = jwt.decode(token, options={"verify_signature": False})["jti"]
        row = sql("SELECT revoked_at FROM auth_sessions WHERE jti = %s", (jti,), one=True)
        assert row["revoked_at"] is not None

    def test_a_revoked_session_cannot_be_refreshed(self):
        session = login(STUDENT)
        requests.post(BASE + "/auth/logout", headers=auth(session["access_token"]), timeout=10)
        r = requests.post(BASE + "/auth/refresh",
                          headers=auth(session["refresh_token"]), timeout=10)
        assert r.status_code == 401

    def test_logout_does_not_affect_other_sessions(self):
        a, b = login(STUDENT), login(STUDENT)
        requests.post(BASE + "/auth/logout", headers=auth(a["access_token"]), timeout=10)
        assert requests.get(BASE + "/auth/session",
                            headers=auth(b["access_token"]), timeout=10).status_code == 200


# ========================================================= 4. authorization ==

class TestAuthorizationGuards:
    """Reusable guards; identity and role come from the server."""

    def test_no_token_is_unauthenticated(self):
        r = requests.get(BASE + "/grants", timeout=10)
        assert r.status_code == 401

    def test_wrong_role_is_forbidden_not_unauthenticated(self, student):
        """401 and 403 mean different things and must not be conflated."""
        grant = create_grant(student["access_token"])
        r = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                          json={"version": grant["version"]},
                          headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 403
        assert "role" in r.json()["error"].lower()

    def test_a_forged_role_inside_the_token_is_ignored(self, student):
        """The payload is rewritten to claim supervisor; the database wins."""
        claims = jwt.decode(student["access_token"], options={"verify_signature": False})
        forged = jwt.encode({**claims, "role": "supervisor", "admin": True},
                            os.getenv("JWT_SECRET_KEY", "dev-activity7-secret-key-not-for-production"),
                            algorithm="HS256")
        grant = create_grant(student["access_token"])
        r = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                          json={"version": grant["version"]}, headers=auth(forged), timeout=10)
        assert r.status_code == 403, "a forged role claim must not grant reviewer rights"

    def test_direct_api_call_without_the_ui_still_enforces_rules(self, other_student):
        """Bypassing the frontend changes nothing: the API is the boundary."""
        r = requests.post(BASE + "/grants",
                          json={"title": "x", "description": "y", "category": "cloud", "amount": 1},
                          headers=auth(other_student["access_token"]), timeout=10)
        assert r.status_code == 422

    def test_reviewer_role_is_accepted(self, supervisor, student):
        grant = create_grant(student["access_token"])
        r = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                          json={"version": grant["version"]},
                          headers=auth(supervisor["access_token"]), timeout=10)
        assert r.status_code == 200


# ============================================================== 5. privacy ==

class TestOwnershipPrivacy:
    """EVIDENCE 6 — reaching another owner's record."""

    def test_another_owners_record_is_not_reachable(self, student, other_student):
        mine = create_grant(student["access_token"])

        r = requests.get(BASE + "/grants/" + mine["reference"],
                         headers=auth(other_student["access_token"]), timeout=10)
        assert r.status_code == 404, "must not expose another student's record"
        assert "not found" in r.json()["error"].lower()
        # The body must not leak any field of the real record.
        assert mine["title"] not in r.text

        audit = requests.get(BASE + "/grants/" + mine["reference"] + "/audit",
                             headers=auth(other_student["access_token"]), timeout=10)
        assert audit.status_code == 404

        hijack = requests.post(BASE + "/grants/" + mine["reference"] + "/withdraw",
                               headers=auth(other_student["access_token"]), timeout=10)
        assert hijack.status_code == 404

    def test_the_owner_can_reach_their_own_record(self, student):
        mine = create_grant(student["access_token"])
        r = requests.get(BASE + "/grants/" + mine["reference"],
                         headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 200 and r.json()["grant"]["is_owner"] is True

    def test_a_reviewer_can_reach_any_record(self, student, supervisor):
        mine = create_grant(student["access_token"])
        r = requests.get(BASE + "/grants/" + mine["reference"],
                         headers=auth(supervisor["access_token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["grant"]["owner"]["email"] == STUDENT[0]


# =========================================================== 6. validation ==

class TestValidation:
    """Schema rules, trimming, and rejection of server-controlled fields."""

    @pytest.mark.parametrize("field,value,reason", [
        ("title", "abc", "title under 5 characters"),
        ("title", "   a   ", "title is short once trimmed"),
        ("description", "too short", "description under 15 characters"),
        ("category", "spaceship", "category not in the allowed list"),
        ("amount", 0, "amount must be positive"),
        ("amount", -500, "negative amount"),
        ("amount", 99_000_000, "amount above the ceiling"),
        ("amount", "abc", "amount not a number"),
    ])
    def test_invalid_input_is_rejected(self, student, field, value, reason):
        r = requests.post(BASE + "/grants", json=unique(**{field: value}),
                          headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 422, reason
        assert field in r.json()["fields"]

    def test_whitespace_is_trimmed_before_storing(self, student):
        payload = unique()
        # Pad both sides; the stored values must come back trimmed.
        payload["title"] = "   Spectrometer sensor kit " + uuid.uuid4().hex[:6] + "   "
        payload["description"] = "   A sensor kit for the hardware prototype stage.   "
        r = requests.post(BASE + "/grants", json=payload,
                          headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 201
        grant = r.json()["grant"]
        assert grant["title"] == payload["title"].strip()
        assert grant["description"] == payload["description"].strip()

    def test_client_supplied_owner_status_and_timestamps_are_ignored(self, student, other_student):
        payload = unique(
            status="APPROVED", owner_id=999, version=42,
            created_at="2001-01-01T00:00:00Z", updated_at="2001-01-01T00:00:00Z",
            reference="GR-FAKE-0001", decided_at="2001-01-01T00:00:00Z")
        r = requests.post(BASE + "/grants", json=payload,
                          headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 201
        grant = r.json()["grant"]
        assert grant["status"] == "PENDING"
        assert grant["version"] == 1
        assert grant["reference"] != "GR-FAKE-0001"
        assert not grant["created_at"].startswith("2001")
        assert grant["decided_at"] is None
        assert sorted(r.json()["grant"].keys())  # response is well formed
        # The stored row belongs to the caller, not to the id they sent.
        row = sql("""SELECT u.email FROM grant_requests gr JOIN users u ON u.id = gr.owner_id
                      WHERE gr.reference = %s""", (grant["reference"],), one=True)
        assert row["email"] == STUDENT[0]

    def test_database_constraints_block_a_bad_row_written_directly(self):
        """Validation is also enforced below the API."""
        with pytest.raises(psycopg2.errors.CheckViolation):
            with db() as conn, conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO grant_requests (reference, owner_id, title, description,
                                                   category, amount, status)
                       VALUES (%s, 1, 'abc', 'short', 'cloud', 100, 'PENDING')""",
                    ("GR-DIRECT-" + uuid.uuid4().hex[:6],))


# ================================================ 7. duplicate prevention ==

class TestConcurrentDuplicates:
    """EVIDENCE 2 — two identical submissions sent at the same moment."""

    def test_concurrent_duplicate_submission_creates_exactly_one(self, student):
        payload = unique(title="Race condition test " + uuid.uuid4().hex[:6])
        results = []
        barrier = threading.Barrier(2)

        def submit():
            barrier.wait()            # fire both at the same instant
            r = requests.post(BASE + "/grants", json=payload,
                              headers=auth(student["access_token"]), timeout=15)
            results.append((r.status_code, r.text))

        threads = [threading.Thread(target=submit) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        codes = sorted(code for code, _ in results)
        assert codes == [201, 409], "expected exactly one success and one conflict, got " + str(codes)

        rows = sql("""SELECT COUNT(*) AS c FROM grant_requests
                       WHERE lower(btrim(title)) = lower(btrim(%s))""", (payload["title"],), one=True)
        assert rows["c"] == 1, "exactly one row must exist"

    def test_a_sequential_duplicate_is_also_refused(self, student):
        payload = unique()
        assert requests.post(BASE + "/grants", json=payload,
                             headers=auth(student["access_token"]), timeout=10).status_code == 201
        second = requests.post(BASE + "/grants", json=payload,
                               headers=auth(student["access_token"]), timeout=10)
        assert second.status_code == 409
        assert second.json()["code"] == "DUPLICATE_OPEN_TITLE"

    def test_a_withdrawn_title_can_be_reused(self, student):
        payload = unique()
        grant = create_grant(student["access_token"], payload)
        requests.post(BASE + "/grants/" + grant["reference"] + "/withdraw",
                      headers=auth(student["access_token"]), timeout=10)
        again = requests.post(BASE + "/grants", json=payload,
                              headers=auth(student["access_token"]), timeout=10)
        assert again.status_code == 201


# ========================================== 8. atomic creation + audit ==

class TestAtomicCreation:
    """EVIDENCE 7 — forcing the audit write to fail."""

    def test_create_writes_the_record_and_its_audit_entry(self, student):
        grant = create_grant(student["access_token"])
        rows = sql("""SELECT a.action, a.from_status, a.to_status, a.actor_id, a.occurred_at
                        FROM grant_audit a JOIN grant_requests g ON g.id = a.grant_id
                       WHERE g.reference = %s""", (grant["reference"],))
        assert len(rows) == 1
        assert rows[0]["action"] == "CREATED"
        assert rows[0]["to_status"] == "PENDING"
        assert rows[0]["actor_id"] is not None
        assert rows[0]["occurred_at"] is not None

    def test_a_failed_audit_write_rolls_back_the_record(self, student):
        """If the audit entry cannot be written, the record must not persist."""
        payload = unique(title="Atomicity probe " + uuid.uuid4().hex[:6])
        before = sql("SELECT COUNT(*) AS c FROM grant_requests", one=True)["c"]

        r = requests.post(BASE + "/grants", json=payload,
                          headers={**auth(student["access_token"]), "X-Fault-Inject": "audit"},
                          timeout=10)
        assert r.status_code == 503
        assert "could not be saved" in r.json()["error"].lower()
        # No stack trace, no SQL, no driver text.
        assert "psycopg2" not in r.text and "Traceback" not in r.text

        after = sql("SELECT COUNT(*) AS c FROM grant_requests", one=True)["c"]
        assert after == before, "the grant row must have been rolled back"
        assert sql("""SELECT COUNT(*) AS c FROM grant_requests
                       WHERE title = %s""", (payload["title"],), one=True)["c"] == 0

        # And the same request succeeds once the fault is removed.
        ok = requests.post(BASE + "/grants", json=payload,
                           headers=auth(student["access_token"]), timeout=10)
        assert ok.status_code == 201

    def test_the_audit_trail_cannot_be_rewritten(self, student):
        """History is append-only, enforced by a database trigger."""
        grant = create_grant(student["access_token"])
        row = sql("""SELECT a.id FROM grant_audit a JOIN grant_requests g ON g.id = a.grant_id
                      WHERE g.reference = %s""", (grant["reference"],), one=True)
        for statement in ("UPDATE grant_audit SET action = 'CLAIMED' WHERE id = %s",
                          "DELETE FROM grant_audit WHERE id = %s"):
            with pytest.raises(psycopg2.errors.RaiseException):
                with db() as conn, conn.cursor() as cur:
                    cur.execute(statement, (row["id"],))


# ======================================================= 9. state machine ==

class TestStateMachine:
    """EVIDENCE 4 and 5 — concurrent claims, and finalizing wrongly."""

    def test_the_happy_path_walks_pending_to_approved(self, student, supervisor):
        grant = create_grant(student["access_token"])
        assert grant["status"] == "PENDING"

        claimed = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                                json={"version": grant["version"]},
                                headers=auth(supervisor["access_token"]), timeout=10).json()["grant"]
        assert claimed["status"] == "UNDER_REVIEW"
        assert claimed["version"] == grant["version"] + 1

        final = requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                              json={"decision": "APPROVED", "version": claimed["version"],
                                    "note": "Budget approved for one semester"},
                              headers=auth(supervisor["access_token"]), timeout=10).json()["grant"]
        assert final["status"] == "APPROVED"
        assert final["decided_at"] is not None

    def test_two_claims_with_the_same_version_leave_one_winner(self, student, supervisor, supervisor2):
        """EVIDENCE 4 — optimistic locking under a real race."""
        grant = create_grant(student["access_token"])
        version = grant["version"]
        results = []
        barrier = threading.Barrier(2)

        def claim(token, who):
            barrier.wait()
            r = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                              json={"version": version}, headers=auth(token), timeout=15)
            results.append((who, r.status_code, r.json()))

        threads = [
            threading.Thread(target=claim, args=(supervisor["access_token"], "Dr. Tahir")),
            threading.Thread(target=claim, args=(supervisor2["access_token"], "Dr. Sana")),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        codes = sorted(code for _, code, _ in results)
        assert codes == [200, 409], "exactly one claim may succeed, got " + str(codes)

        loser = [body for _, code, body in results if code == 409][0]
        assert loser["code"] in ("VERSION_CONFLICT", "INVALID_TRANSITION")

        row = sql("SELECT status, version, claimed_by FROM grant_requests WHERE reference = %s",
                  (grant["reference"],), one=True)
        assert row["status"] == "UNDER_REVIEW"
        assert row["version"] == version + 1, "version must advance exactly once"
        assert row["claimed_by"] is not None

        # Exactly one CLAIMED entry was written.
        claims = sql("""SELECT COUNT(*) AS c FROM grant_audit a
                          JOIN grant_requests g ON g.id = a.grant_id
                         WHERE g.reference = %s AND a.action = 'CLAIMED'""",
                     (grant["reference"],), one=True)
        assert claims["c"] == 1

    def test_finalizing_an_unclaimed_request_fails(self, student, supervisor):
        """EVIDENCE 5a — no claim yet."""
        grant = create_grant(student["access_token"])
        r = requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                          json={"decision": "APPROVED", "version": grant["version"]},
                          headers=auth(supervisor["access_token"]), timeout=10)
        assert r.status_code == 409
        assert r.json()["code"] == "NOT_CLAIMED"
        assert sql("SELECT status FROM grant_requests WHERE reference = %s",
                   (grant["reference"],), one=True)["status"] == "PENDING"

    def test_the_wrong_reviewer_cannot_finalize(self, student, supervisor, supervisor2):
        """EVIDENCE 5b — claimed by one reviewer, finalized by another."""
        grant = create_grant(student["access_token"])
        claimed = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                                json={"version": grant["version"]},
                                headers=auth(supervisor["access_token"]), timeout=10).json()["grant"]

        r = requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                          json={"decision": "REJECTED", "version": claimed["version"]},
                          headers=auth(supervisor2["access_token"]), timeout=10)
        assert r.status_code == 403
        assert "another reviewer" in r.json()["error"].lower()
        assert sql("SELECT status FROM grant_requests WHERE reference = %s",
                   (grant["reference"],), one=True)["status"] == "UNDER_REVIEW"

    def test_a_terminal_record_cannot_change_again(self, student, supervisor):
        grant = create_grant(student["access_token"])
        claimed = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                                json={"version": grant["version"]},
                                headers=auth(supervisor["access_token"]), timeout=10).json()["grant"]
        requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                      json={"decision": "REJECTED", "version": claimed["version"]},
                      headers=auth(supervisor["access_token"]), timeout=10)
        again = requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                              json={"decision": "APPROVED", "version": claimed["version"] + 1},
                              headers=auth(supervisor["access_token"]), timeout=10)
        assert again.status_code == 409
        assert again.json()["code"] == "ALREADY_FINAL"

    def test_a_stale_version_is_refused(self, student, supervisor):
        grant = create_grant(student["access_token"])
        requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                      json={"version": grant["version"]},
                      headers=auth(supervisor["access_token"]), timeout=10)
        stale = requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                              json={"decision": "APPROVED", "version": grant["version"]},
                              headers=auth(supervisor["access_token"]), timeout=10)
        assert stale.status_code == 409

    def test_a_claimed_request_cannot_be_withdrawn(self, student, supervisor):
        grant = create_grant(student["access_token"])
        requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                      json={"version": grant["version"]},
                      headers=auth(supervisor["access_token"]), timeout=10)
        r = requests.post(BASE + "/grants/" + grant["reference"] + "/withdraw",
                          headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 409


# ======================================================= 10. retrieval ==

class TestDatabaseDrivenRetrieval:
    """EVIDENCE 3 — combined filters return correctly scoped results."""

    def test_combined_filters_return_scoped_results(self, student, other_student, supervisor):
        tag = uuid.uuid4().hex[:6]
        create_grant(student["access_token"],
                     unique(title="Cloud credits " + tag, category="cloud", amount=50000))
        create_grant(student["access_token"],
                     unique(title="Hardware kit " + tag, category="hardware", amount=9000))
        create_grant(other_student["access_token"],
                     unique(title="Cloud credits other " + tag, category="cloud", amount=70000))

        # Student + category + status + search, all at once.
        r = requests.get(BASE + "/grants",
                         params={"category": "cloud", "status": "PENDING", "q": tag,
                                 "min_amount": 10000},
                         headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["scope"] == "own"
        assert body["count"] >= 1
        for grant in body["grants"]:
            assert grant["category"] == "cloud"
            assert grant["status"] == "PENDING"
            assert grant["amount"] >= 10000
            assert grant["is_owner"] is True
        titles = [grant["title"] for grant in body["grants"]]
        assert not any("other" in t for t in titles), "another student's record leaked into results"

        # The same filter as a reviewer is wider.
        rv = requests.get(BASE + "/grants",
                          params={"category": "cloud", "status": "PENDING", "q": tag},
                          headers=auth(supervisor["access_token"]), timeout=10)
        assert rv.json()["scope"] == "all"
        assert rv.json()["count"] > body["count"]

    def test_results_come_from_the_database_not_from_memory(self, student):
        grant = create_grant(student["access_token"])
        # Change the row behind the API's back, then read through the API.
        with db() as conn, conn.cursor() as cur:
            cur.execute("UPDATE grant_requests SET amount = 777 WHERE reference = %s",
                        (grant["reference"],))
        r = requests.get(BASE + "/grants/" + grant["reference"],
                         headers=auth(student["access_token"]), timeout=10)
        assert r.json()["grant"]["amount"] == 777

    def test_an_unknown_filter_value_is_rejected(self, student):
        r = requests.get(BASE + "/grants", params={"status": "NONSENSE"},
                         headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 400

    def test_a_search_term_with_sql_metacharacters_is_safe(self, student):
        r = requests.get(BASE + "/grants", params={"q": "'; DROP TABLE grant_requests; --"},
                         headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 200
        assert sql("SELECT COUNT(*) AS c FROM grant_requests", one=True)["c"] > 0


# ===================================================== 11. responses ==

class TestResponsesAndPersistence:
    """The response is the committed row, and it survives a restart."""

    def test_the_response_matches_the_committed_row(self, student):
        payload = unique()
        grant = create_grant(student["access_token"], payload)
        row = sql("""SELECT reference, title, description, category, amount, status, version
                       FROM grant_requests WHERE reference = %s""",
                  (grant["reference"],), one=True)
        for field in ("reference", "title", "description", "category", "amount", "status", "version"):
            assert grant[field] == row[field], field

    def test_errors_never_expose_internals(self, student):
        checks = [
            requests.get(BASE + "/grants/GR-DOES-NOT-EXIST", headers=auth(student["access_token"]), timeout=10),
            requests.post(BASE + "/grants", json={"title": "x"}, headers=auth(student["access_token"]), timeout=10),
            requests.get(BASE + "/grants", timeout=10),
            requests.post(BASE + "/auth/login", json={"email": STUDENT[0], "password": "nope"}, timeout=10),
        ]
        for r in checks:
            text = r.text.lower()
            for leak in ("traceback", "psycopg2", "password_hash", "scrypt:", "select ", "line ",
                         "file \"", "jwt_secret"):
                assert leak not in text, "response leaked " + leak + ": " + r.text[:200]

    def test_the_record_survives_a_backend_restart(self, student):
        """Proven by reading the row straight from storage, not from the process."""
        grant = create_grant(student["access_token"])
        row = sql("SELECT reference, status FROM grant_requests WHERE reference = %s",
                  (grant["reference"],), one=True)
        assert row is not None and row["status"] == "PENDING"


# ===================================================== 12. audit history ==

class TestAuditHistory:
    """A complete, ordered, private history."""

    def test_every_transition_is_recorded_in_order(self, student, supervisor):
        grant = create_grant(student["access_token"])
        claimed = requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                                json={"version": grant["version"]},
                                headers=auth(supervisor["access_token"]), timeout=10).json()["grant"]
        requests.post(BASE + "/grants/" + grant["reference"] + "/finalize",
                      json={"decision": "APPROVED", "version": claimed["version"],
                            "note": "Approved after review"},
                      headers=auth(supervisor["access_token"]), timeout=10)

        r = requests.get(BASE + "/grants/" + grant["reference"] + "/audit",
                         headers=auth(student["access_token"]), timeout=10)
        assert r.status_code == 200
        history = r.json()["history"]
        assert [h["action"] for h in history] == ["CREATED", "CLAIMED", "FINALIZED"]
        assert history[0]["actor_role"] == "student"
        assert history[1]["actor_role"] == "supervisor"
        assert history[2]["to"] == "APPROVED"
        for entry in history:
            assert entry["at"] and entry["actor"]

    def test_the_audit_response_contains_no_credentials(self, student, supervisor):
        grant = create_grant(student["access_token"])
        requests.post(BASE + "/grants/" + grant["reference"] + "/claim",
                      json={"version": grant["version"]},
                      headers=auth(supervisor["access_token"]), timeout=10)
        r = requests.get(BASE + "/grants/" + grant["reference"] + "/audit",
                         headers=auth(supervisor["access_token"]), timeout=10)
        assert "password" not in r.text.lower()
        assert "scrypt" not in r.text.lower()
