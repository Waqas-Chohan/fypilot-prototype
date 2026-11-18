"""
FYPilot — Activity 7: secure grant-request workflow.

Everything the client sends is treated as untrusted. Identity, role, owner,
status and all timestamps are derived server-side from the database.

Design notes
------------
* Sessions   A JWT on its own cannot be withdrawn, so each token carries a
             jti that must match a live row in auth_sessions. Logout revokes
             that row, which makes a replayed token useless immediately.
* Guards     @authenticated and @require_role are the only way a route gets
             an identity. They always re-read the user from the database, so
             a role claim forged into a token body is ignored.
* Atomicity  A create writes the record and its audit entry in one
             transaction; if either write fails, neither persists.
* Concurrency  Every state change is a conditional UPDATE guarded by the
             row's version, so of two simultaneous claims exactly one wins.
* Privacy    A record belonging to another owner answers 404, not 403, so the
             API never confirms that someone else's record exists.
"""

import os
import re
import uuid
import secrets
import datetime as dt
from functools import wraps

import jwt
import psycopg2
import psycopg2.extras
from flask import Blueprint, request, jsonify, g, current_app

bp = Blueprint("workflow", __name__, url_prefix="/api/v2")

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

ACCESS_TTL = dt.timedelta(minutes=int(os.getenv("ACCESS_TTL_MINUTES", "15")))
SESSION_TTL = dt.timedelta(days=int(os.getenv("SESSION_TTL_DAYS", "7")))
ALGORITHM = "HS256"

CATEGORIES = ("hardware", "cloud", "api", "travel", "other")
STATUSES = ("PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN")
REVIEWER_ROLES = ("supervisor", "coordinator")

# The state machine. A transition that is not listed here cannot happen.
TRANSITIONS = {
    "PENDING":      {"CLAIMED": "UNDER_REVIEW", "WITHDRAWN": "WITHDRAWN"},
    "UNDER_REVIEW": {"FINALIZED": None},          # None -> APPROVED or REJECTED
    "APPROVED":     {},                            # terminal
    "REJECTED":     {},                            # terminal
    "WITHDRAWN":    {},                            # terminal
}
FINAL_STATUSES = ("APPROVED", "REJECTED")


def _secret():
    return current_app.config["JWT_SECRET_KEY"]


def _fault(name):
    """Test-only fault injection, off unless explicitly enabled.

    Used to prove that a failed audit write rolls the whole transaction
    back. Never enabled in production.
    """
    if os.getenv("ALLOW_FAULT_INJECTION", "false").lower() != "true":
        return False
    return request.headers.get("X-Fault-Inject", "") == name


# --------------------------------------------------------------------------
# Database helpers
# --------------------------------------------------------------------------

def _conn():
    """One psycopg2 connection per request, with autocommit off."""
    if "wf_db" not in g:
        g.wf_db = psycopg2.connect(
            os.getenv("DATABASE_URL"),
            connect_timeout=5,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        g.wf_db.autocommit = False
    return g.wf_db


@bp.teardown_request
def _close_conn(exc):
    db = g.pop("wf_db", None)
    if db is not None:
        try:
            if exc is not None:
                db.rollback()
        finally:
            db.close()


class Tx:
    """`with Tx() as cur:` — commits on success, rolls back on any exception."""

    def __enter__(self):
        self.conn = _conn()
        self.cur = self.conn.cursor()
        return self.cur

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
        finally:
            self.cur.close()
        return False


def fetch_one(sql, args=()):
    with _conn().cursor() as cur:
        cur.execute(sql, args)
        row = cur.fetchone()
    _conn().commit()
    return row


def fetch_all(sql, args=()):
    with _conn().cursor() as cur:
        cur.execute(sql, args)
        rows = cur.fetchall()
    _conn().commit()
    return rows


# --------------------------------------------------------------------------
# Error helpers — safe messages only
# --------------------------------------------------------------------------

def err(message, http_status, **extra):
    """A client-safe error. Never contains hashes, SQL or stack traces.

    `http_status` is the HTTP code; any extra keyword becomes a field in the
    body (for example code="VERSION_CONFLICT"), so machine-readable detail
    can travel with the message.
    """
    body = {"error": message}
    body.update(extra)
    return jsonify(body), http_status


def _unauthenticated(message="Authentication required"):
    """401 — we do not know who you are."""
    return err(message, 401)


def _forbidden(message="You do not have permission to perform this action"):
    """403 — we know who you are, and you may not do this."""
    return err(message, 403)


# --------------------------------------------------------------------------
# Sessions
# --------------------------------------------------------------------------

def issue_session(cur, user_id):
    """Create a server-side session and return its tokens."""
    jti = str(uuid.uuid4())
    now = dt.datetime.now(dt.timezone.utc)
    access_exp = now + ACCESS_TTL
    session_exp = now + SESSION_TTL
    cur.execute(
        """INSERT INTO auth_sessions (jti, user_id, issued_at, access_expires, session_expires)
           VALUES (%s, %s, %s, %s, %s)""",
        (jti, user_id, now, access_exp, session_exp),
    )
    access = jwt.encode(
        {"sub": str(user_id), "jti": jti, "typ": "access",
         "iat": int(now.timestamp()), "exp": int(access_exp.timestamp())},
        _secret(), algorithm=ALGORITHM)
    refresh = jwt.encode(
        {"sub": str(user_id), "jti": jti, "typ": "refresh",
         "iat": int(now.timestamp()), "exp": int(session_exp.timestamp())},
        _secret(), algorithm=ALGORITHM)
    return {"access_token": access, "refresh_token": refresh,
            "expires_in": int(ACCESS_TTL.total_seconds()), "jti": jti}


def _bearer():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[7:].strip() or None


def resolve_identity(expect="access"):
    """Return (identity, error).

    The token is only a pointer. Identity and role always come from the
    database, so a tampered or forged payload cannot grant anything.
    """
    token = _bearer()
    if not token:
        return None, _unauthenticated()
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None, _unauthenticated("Session expired, please sign in again")
    except jwt.InvalidTokenError:
        return None, _unauthenticated("Invalid or tampered token")

    if payload.get("typ") != expect:
        return None, _unauthenticated("Wrong token type for this endpoint")

    jti = payload.get("jti")
    if not jti:
        return None, _unauthenticated("Invalid or tampered token")

    row = fetch_one(
        """SELECT s.jti, s.revoked_at, s.session_expires, s.access_expires,
                  u.id AS user_id, u.name, u.email, u.role
             FROM auth_sessions s
             JOIN users u ON u.id = s.user_id
            WHERE s.jti = %s""",
        (jti,),
    )
    # Session must still exist, not be revoked, and not have lapsed.
    if row is None:
        return None, _unauthenticated("Session is no longer valid")
    if row["revoked_at"] is not None:
        return None, _unauthenticated("Session has been logged out")
    if row["session_expires"] <= dt.datetime.now(dt.timezone.utc):
        return None, _unauthenticated("Session expired, please sign in again")

    # NOTE: role comes from the users table, never from the token payload.
    return {"id": row["user_id"], "name": row["name"], "email": row["email"],
            "role": row["role"], "jti": jti}, None


# --------------------------------------------------------------------------
# Reusable guards
# --------------------------------------------------------------------------

def authenticated(fn):
    """Require a live session. Puts the server-derived identity on g.me."""
    @wraps(fn)
    def wrapper(*a, **kw):
        me, error = resolve_identity()
        if error:
            return error
        g.me = me
        fetch_one("UPDATE auth_sessions SET last_seen_at = now() WHERE jti = %s RETURNING jti",
                  (me["jti"],))
        return fn(*a, **kw)
    return wrapper


def require_role(*roles):
    """Require a live session whose database role is one of `roles`."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            me, error = resolve_identity()
            if error:
                return error
            g.me = me
            if me["role"] not in roles:
                return _forbidden(
                    "This action requires one of these roles: " + ", ".join(roles))
            return fn(*a, **kw)
        return wrapper
    return decorator


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

CLIENT_CONTROLLED = ("title", "description", "category", "amount")
SERVER_CONTROLLED = ("owner_id", "owner", "status", "version", "created_at",
                     "updated_at", "claimed_by", "claimed_at", "decided_at",
                     "reference", "id")


def validate_grant_payload(data):
    """Return (clean, errors, ignored). Server-controlled fields are dropped."""
    errors = {}
    clean = {}
    ignored = [k for k in data if k in SERVER_CONTROLLED]

    title = data.get("title")
    title = title.strip() if isinstance(title, str) else ""
    if len(title) < 5:
        errors["title"] = "Title must be at least 5 characters after trimming"
    elif len(title) > 120:
        errors["title"] = "Title must be at most 120 characters"
    else:
        clean["title"] = title

    desc = data.get("description")
    desc = desc.strip() if isinstance(desc, str) else ""
    if len(desc) < 15:
        errors["description"] = "Description must be at least 15 characters after trimming"
    elif len(desc) > 2000:
        errors["description"] = "Description must be at most 2000 characters"
    else:
        clean["description"] = desc

    category = data.get("category")
    category = category.strip().lower() if isinstance(category, str) else ""
    if category not in CATEGORIES:
        errors["category"] = "Category must be one of: " + ", ".join(CATEGORIES)
    else:
        clean["category"] = category

    amount = data.get("amount")
    if isinstance(amount, bool) or not isinstance(amount, (int, float, str)):
        errors["amount"] = "Amount must be a whole number"
    else:
        try:
            amount = int(str(amount).strip())
            if amount <= 0 or amount > 10_000_000:
                errors["amount"] = "Amount must be between 1 and 10,000,000"
            else:
                clean["amount"] = amount
        except (TypeError, ValueError):
            errors["amount"] = "Amount must be a whole number"

    return clean, errors, ignored


def new_reference():
    """A unique, non-guessable public identifier (ids are never exposed)."""
    return "GR-" + dt.datetime.now(dt.timezone.utc).strftime("%Y") + "-" + \
        secrets.token_hex(4).upper()


# --------------------------------------------------------------------------
# Serialisation — never leaks hashes or internal ids
# --------------------------------------------------------------------------

def present(row, me):
    out = {
        "reference": row["reference"],
        "title": row["title"],
        "description": row["description"],
        "category": row["category"],
        "amount": row["amount"],
        "status": row["status"],
        "version": row["version"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "claimed_at": row["claimed_at"].isoformat() if row.get("claimed_at") else None,
        "decided_at": row["decided_at"].isoformat() if row.get("decided_at") else None,
        "decision_note": row.get("decision_note"),
        "is_owner": row["owner_id"] == me["id"],
    }
    # Reviewers need to know whose request it is; owners already know.
    if me["role"] in REVIEWER_ROLES:
        out["owner"] = {"name": row.get("owner_name"), "email": row.get("owner_email")}
        out["claimed_by"] = row.get("claimer_name")
    return out


SELECT_GRANT = """
    SELECT gr.*, o.name AS owner_name, o.email AS owner_email,
           c.name AS claimer_name
      FROM grant_requests gr
      JOIN users o ON o.id = gr.owner_id
      LEFT JOIN users c ON c.id = gr.claimed_by
"""


def load_visible(reference, me, cur=None, lock=False):
    """Load a record the caller is allowed to see, else None.

    Students only ever see their own records. A record owned by someone
    else is reported as missing, so the API does not confirm it exists.
    """
    sql = SELECT_GRANT + " WHERE gr.reference = %s"
    args = [reference]
    if me["role"] not in REVIEWER_ROLES:
        sql += " AND gr.owner_id = %s"
        args.append(me["id"])
    if lock:
        sql += " FOR UPDATE OF gr"
    if cur is not None:
        cur.execute(sql, tuple(args))
        return cur.fetchone()
    return fetch_one(sql, tuple(args))


def write_audit(cur, grant_id, actor, action, from_status, to_status, detail=None):
    """Append one audit entry. Called inside the caller's transaction."""
    if _fault("audit"):
        # Test-only: simulate the audit store failing mid-transaction.
        raise psycopg2.OperationalError("injected audit write failure")
    cur.execute(
        """INSERT INTO grant_audit
               (grant_id, actor_id, actor_role, action, from_status, to_status, detail)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (grant_id, actor["id"], actor["role"], action, from_status, to_status, detail),
    )


# --------------------------------------------------------------------------
# Authentication endpoints
# --------------------------------------------------------------------------

@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
        return err("Email and password are required", 400)

    from werkzeug.security import check_password_hash
    row = fetch_one("SELECT id, name, email, role, password_hash FROM users WHERE email = %s",
                    (email.strip().lower(),))
    # One message for both cases, so the response cannot be used to discover
    # which email addresses are registered.
    if row is None or not check_password_hash(row["password_hash"], password):
        return err("Invalid email or password", 401)

    with Tx() as cur:
        tokens = issue_session(cur, row["id"])
    return jsonify({
        "message": "Signed in",
        "user": {"name": row["name"], "email": row["email"], "role": row["role"]},
        **{k: v for k, v in tokens.items() if k != "jti"},
    }), 200


@bp.post("/auth/refresh")
def refresh():
    """Exchange a refresh token for a new access token.

    The session row is untouched, so a page reload after the access token
    has lapsed keeps the user signed in — but a logged-out session cannot
    be refreshed.
    """
    me, error = resolve_identity(expect="refresh")
    if error:
        return error
    now = dt.datetime.now(dt.timezone.utc)
    access_exp = now + ACCESS_TTL
    with Tx() as cur:
        cur.execute("UPDATE auth_sessions SET access_expires = %s WHERE jti = %s",
                    (access_exp, me["jti"]))
    access = jwt.encode(
        {"sub": str(me["id"]), "jti": me["jti"], "typ": "access",
         "iat": int(now.timestamp()), "exp": int(access_exp.timestamp())},
        _secret(), algorithm=ALGORITHM)
    return jsonify({"access_token": access,
                    "expires_in": int(ACCESS_TTL.total_seconds())}), 200


@bp.post("/auth/logout")
@authenticated
def logout():
    """Invalidate the credential server-side. Replaying it afterwards fails."""
    with Tx() as cur:
        cur.execute(
            "UPDATE auth_sessions SET revoked_at = now() WHERE jti = %s AND revoked_at IS NULL",
            (g.me["jti"],))
    return jsonify({"message": "Signed out, this session is no longer valid"}), 200


@bp.get("/auth/session")
@authenticated
def session_info():
    """Used by the frontend on page load to confirm the session survives a refresh."""
    return jsonify({"user": {"name": g.me["name"], "email": g.me["email"],
                             "role": g.me["role"]}, "authenticated": True}), 200


# --------------------------------------------------------------------------
# Grant endpoints
# --------------------------------------------------------------------------

@bp.post("/grants")
@require_role("student")
def create_grant():
    """Create a PENDING record and its CREATED audit entry atomically."""
    data = request.get_json(silent=True) or {}
    clean, errors, ignored = validate_grant_payload(data)
    if errors:
        return jsonify({"error": "Validation failed", "fields": errors,
                        "ignored_fields": ignored}), 422

    me = g.me
    try:
        with Tx() as cur:
            cur.execute(
                """INSERT INTO grant_requests
                       (reference, owner_id, title, description, category, amount, status)
                   VALUES (%s, %s, %s, %s, %s, %s, 'PENDING')
                   RETURNING id""",
                (new_reference(), me["id"], clean["title"], clean["description"],
                 clean["category"], clean["amount"]),
            )
            grant_id = cur.fetchone()["id"]
            # Same transaction: if this fails, the record above never persists.
            write_audit(cur, grant_id, me, "CREATED", None, "PENDING",
                        "Submitted by owner")
            cur.execute(SELECT_GRANT + " WHERE gr.id = %s", (grant_id,))
            row = cur.fetchone()
    except psycopg2.errors.UniqueViolation:
        return err("You already have an open request with this title", 409,
                   code="DUPLICATE_OPEN_TITLE")
    except psycopg2.errors.CheckViolation:
        return err("The request did not pass database validation", 422)
    except psycopg2.OperationalError:
        current_app.logger.exception("grant create failed")
        return err("The request could not be saved. Nothing was changed.", 503,
                   code="STORAGE_UNAVAILABLE")

    # The body is read back from the committed row, not echoed from input.
    return jsonify({"message": "Grant request submitted", "grant": present(row, me)}), 201


@bp.get("/grants")
@authenticated
def list_grants():
    """Owner-scoped list with combinable filters."""
    me = g.me
    sql = SELECT_GRANT + " WHERE 1=1"
    args = []

    if me["role"] not in REVIEWER_ROLES:
        sql += " AND gr.owner_id = %s"
        args.append(me["id"])

    status = (request.args.get("status") or "").strip().upper()
    if status:
        if status not in STATUSES:
            return err("Unknown status filter", 400)
        sql += " AND gr.status = %s"
        args.append(status)

    category = (request.args.get("category") or "").strip().lower()
    if category:
        if category not in CATEGORIES:
            return err("Unknown category filter", 400)
        sql += " AND gr.category = %s"
        args.append(category)

    q = (request.args.get("q") or "").strip()
    if q:
        sql += " AND (gr.title ILIKE %s OR gr.description ILIKE %s)"
        args.extend(["%" + q + "%", "%" + q + "%"])

    min_amount = (request.args.get("min_amount") or "").strip()
    if min_amount:
        try:
            sql += " AND gr.amount >= %s"
            args.append(int(min_amount))
        except ValueError:
            return err("min_amount must be a whole number", 400)

    mine = (request.args.get("mine") or "").strip().lower()
    if mine in ("1", "true", "yes"):
        sql += " AND gr.owner_id = %s"
        args.append(me["id"])

    sql += " ORDER BY gr.created_at DESC LIMIT 200"
    rows = fetch_all(sql, tuple(args))
    return jsonify({
        "count": len(rows),
        "scope": "own" if me["role"] not in REVIEWER_ROLES else "all",
        "filters": {"status": status or None, "category": category or None,
                    "q": q or None, "min_amount": min_amount or None},
        "grants": [present(r, me) for r in rows],
    }), 200


@bp.get("/grants/<reference>")
@authenticated
def get_grant(reference):
    row = load_visible(reference, g.me)
    if row is None:
        return err("Grant request not found", 404)
    return jsonify({"grant": present(row, g.me)}), 200


@bp.post("/grants/<reference>/claim")
@require_role(*REVIEWER_ROLES)
def claim_grant(reference):
    """Take ownership of a review. Guarded by the record's version."""
    data = request.get_json(silent=True) or {}
    try:
        expected = int(data.get("version"))
    except (TypeError, ValueError):
        return err("A numeric 'version' is required to claim a request", 400,
                   code="VERSION_REQUIRED")

    me = g.me
    with Tx() as cur:
        cur.execute(SELECT_GRANT + " WHERE gr.reference = %s", (reference,))
        row = cur.fetchone()
        if row is None:
            return err("Grant request not found", 404)
        if row["status"] != "PENDING":
            return err(
                "Only a pending request can be claimed (this one is " +
                row["status"] + ")", 409,
                code="INVALID_TRANSITION", status=row["status"],
                claimed_by=row.get("claimer_name"))

        # Optimistic lock: of two identical claims, only the first matches.
        cur.execute(
            """UPDATE grant_requests
                  SET status = 'UNDER_REVIEW', claimed_by = %s, claimed_at = now(),
                      version = version + 1, updated_at = now()
                WHERE id = %s AND status = 'PENDING' AND version = %s
            RETURNING id, version""",
            (me["id"], row["id"], expected))
        updated = cur.fetchone()
        if updated is None:
            cur.connection.rollback()
            fresh = fetch_one(SELECT_GRANT + " WHERE gr.reference = %s", (reference,))
            return err("This request was changed by someone else. Reload and try again.",
                       409, code="VERSION_CONFLICT",
                       your_version=expected,
                       current_version=fresh["version"] if fresh else None,
                       current_status=fresh["status"] if fresh else None,
                       claimed_by=fresh.get("claimer_name") if fresh else None)

        write_audit(cur, row["id"], me, "CLAIMED", "PENDING", "UNDER_REVIEW",
                    "Claimed for review")
        cur.execute(SELECT_GRANT + " WHERE gr.id = %s", (row["id"],))
        row = cur.fetchone()

    return jsonify({"message": "Claimed for review", "grant": present(row, me)}), 200


@bp.post("/grants/<reference>/finalize")
@require_role(*REVIEWER_ROLES)
def finalize_grant(reference):
    """Approve or reject. Only the reviewer who claimed it may finalize."""
    data = request.get_json(silent=True) or {}
    decision = (data.get("decision") or "").strip().upper()
    if decision not in FINAL_STATUSES:
        return err("Decision must be APPROVED or REJECTED", 400)
    note = data.get("note")
    note = note.strip()[:200] if isinstance(note, str) else None
    try:
        expected = int(data.get("version"))
    except (TypeError, ValueError):
        return err("A numeric 'version' is required to finalize a request", 400,
                   code="VERSION_REQUIRED")

    me = g.me
    with Tx() as cur:
        cur.execute(SELECT_GRANT + " WHERE gr.reference = %s", (reference,))
        row = cur.fetchone()
        if row is None:
            return err("Grant request not found", 404)

        # A pending request has not been claimed by anyone yet.
        if row["status"] == "PENDING":
            return err("This request must be claimed before it can be finalized", 409,
                       code="NOT_CLAIMED", status=row["status"])
        if row["status"] in FINAL_STATUSES or row["status"] == "WITHDRAWN":
            return err("This request is already " + row["status"].lower(), 409,
                       code="ALREADY_FINAL", status=row["status"])
        # Claimed by a different reviewer: forbidden, not merely a conflict.
        if row["claimed_by"] != me["id"]:
            return _forbidden(
                "This request is being reviewed by another reviewer, so only they can finalize it")

        cur.execute(
            """UPDATE grant_requests
                  SET status = %s, decided_at = now(), decision_note = %s,
                      version = version + 1, updated_at = now()
                WHERE id = %s AND status = 'UNDER_REVIEW'
                  AND claimed_by = %s AND version = %s
            RETURNING id""",
            (decision, note, row["id"], me["id"], expected))
        if cur.fetchone() is None:
            cur.connection.rollback()
            fresh = fetch_one(SELECT_GRANT + " WHERE gr.reference = %s", (reference,))
            return err("This request was changed by someone else. Reload and try again.",
                       409, code="VERSION_CONFLICT",
                       your_version=expected,
                       current_version=fresh["version"] if fresh else None,
                       current_status=fresh["status"] if fresh else None)

        write_audit(cur, row["id"], me, "FINALIZED", "UNDER_REVIEW", decision, note)
        cur.execute(SELECT_GRANT + " WHERE gr.id = %s", (row["id"],))
        row = cur.fetchone()

    return jsonify({"message": "Request " + decision.lower(),
                    "grant": present(row, me)}), 200


@bp.post("/grants/<reference>/withdraw")
@require_role("student")
def withdraw_grant(reference):
    """The owner may withdraw their own request while it is still pending."""
    me = g.me
    with Tx() as cur:
        row = load_visible(reference, me, cur=cur, lock=True)
        if row is None:
            return err("Grant request not found", 404)
        if row["status"] != "PENDING":
            return err("Only a pending request can be withdrawn (this one is " +
                       row["status"] + ")", 409, code="INVALID_TRANSITION")
        cur.execute(
            """UPDATE grant_requests
                  SET status = 'WITHDRAWN', version = version + 1, updated_at = now()
                WHERE id = %s AND status = 'PENDING'""",
            (row["id"],))
        write_audit(cur, row["id"], me, "WITHDRAWN", "PENDING", "WITHDRAWN",
                    "Withdrawn by owner")
        cur.execute(SELECT_GRANT + " WHERE gr.id = %s", (row["id"],))
        row = cur.fetchone()
    return jsonify({"message": "Request withdrawn", "grant": present(row, me)}), 200


@bp.get("/grants/<reference>/audit")
@authenticated
def grant_audit(reference):
    """History of one record. Visible to its owner and to reviewers only."""
    row = load_visible(reference, g.me)
    if row is None:
        return err("Grant request not found", 404)
    entries = fetch_all(
        """SELECT a.action, a.from_status, a.to_status, a.detail, a.occurred_at,
                  u.name AS actor_name, a.actor_role
             FROM grant_audit a
             JOIN users u ON u.id = a.actor_id
            WHERE a.grant_id = %s
            ORDER BY a.occurred_at ASC, a.id ASC""",
        (row["id"],))
    return jsonify({
        "reference": row["reference"],
        "history": [{
            "action": e["action"],
            "from": e["from_status"],
            "to": e["to_status"],
            "detail": e["detail"],
            "actor": e["actor_name"],
            "actor_role": e["actor_role"],
            "at": e["occurred_at"].isoformat(),
        } for e in entries],
    }), 200


# --------------------------------------------------------------------------
# Blueprint-wide safety net
# --------------------------------------------------------------------------

@bp.errorhandler(psycopg2.OperationalError)
def _db_down(e):
    """The database is unreachable: report it plainly, leak nothing."""
    current_app.logger.exception("database unavailable")
    return err("Service temporarily unavailable, please try again shortly", 503,
               code="STORAGE_UNAVAILABLE")


@bp.errorhandler(Exception)
def _unexpected(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return err(e.name, e.code)
    current_app.logger.exception("unhandled error in workflow blueprint")
    return err("Internal server error", 500)
