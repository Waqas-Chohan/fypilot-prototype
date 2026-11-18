import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()
import re
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_SIMILARITY = ("low", "medium", "high")
app = Flask(__name__)
# Secrets must come from backend/.env - no insecure fallback values.
if not os.getenv("JWT_SECRET_KEY") or not os.getenv("DATABASE_URL"):
    raise RuntimeError("JWT_SECRET_KEY and DATABASE_URL must be set in backend/.env")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60  # 1 hour
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"
# Allowed browser origins. Override in production with FRONTEND_ORIGINS (comma-separated),
# e.g. FRONTEND_ORIGINS=https://fypilot.vercel.app
DEFAULT_ORIGINS = "http://localhost:8080,http://127.0.0.1:8080,https://fypilot.vercel.app"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]
CORS(app, origins=ALLOWED_ORIGINS, allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
jwt = JWTManager(app)

# Activity 7 - secure grant workflow (sessions, RBAC, state machine, audit).
from workflow import bp as workflow_bp  # noqa: E402
app.register_blueprint(workflow_bp)


# ---------- Server-side validation helpers (Activity 6, Task 5) ----------
def clean_str(value, min_len, max_len):
    """Return a trimmed string within limits, or None if invalid / not a string."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if len(value) < min_len or len(value) > max_len:
        return None
    return value


def bad(msg, code=400):
    return jsonify({"error": msg}), code


@jwt.unauthorized_loader
def missing_token(reason):
    return jsonify({"error": "Authentication required"}), 401


@jwt.invalid_token_loader
def invalid_token(reason):
    return jsonify({"error": "Invalid or tampered token"}), 401


@jwt.expired_token_loader
def expired_token(header, payload):
    return jsonify({"error": "Token expired, please log in again"}), 401


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(405)
def not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(Exception)
def handle_unexpected(e):
    # Never leak stack traces / SQL / driver messages to the client.
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return jsonify({"error": e.name}), e.code
    app.logger.exception("Unhandled error")
    return jsonify({"error": "Internal server error"}), 500
def get_db():
    if "db" not in g:
        g.db = psycopg2.connect(os.getenv("DATABASE_URL"), connect_timeout=10, cursor_factory=psycopg2.extras.RealDictCursor)
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False, commit=False):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    if commit:
        conn.commit()
        cur.close()
        return None
    if one:
        result = cur.fetchone()
        cur.close()
        return result
    result = cur.fetchall()
    cur.close()
    return result

def _split_sql(sql):
    """Split on semicolons, but keep $$ ... $$ function bodies intact."""
    out, buf, in_dollar = [], [], False
    for line in sql.splitlines():
        if line.count("$$") % 2 == 1:
            in_dollar = not in_dollar
        buf.append(line)
        if not in_dollar and line.rstrip().endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";").strip()
            if stmt:
                out.append(stmt)
            buf = []
    tail = "\n".join(buf).strip().rstrip(";").strip()
    if tail:
        out.append(tail)
    return out


def init_db():
    schema_sql = ""
    for name in ("schema.sql", "schema_activity7.sql"):
        schema_path = os.path.join(os.path.dirname(__file__), name)
        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql += "\n" + f.read()
    conn = get_db()
    cur = conn.cursor()
    statements = _split_sql(schema_sql)
    for stmt in statements:
        if stmt:
            try:
                cur.execute(stmt)
            except Exception as e:
                if "already exists" in str(e) or "duplicate key" in str(e) or "permission denied" in str(e) or "insufficient privilege" in str(e):
                    continue
                raise
    conn.commit()
    cur.close()
    if os.getenv("SEED_DEMO_USERS", "true").lower() == "false":
        print("Database initialized (demo users not seeded).")
        return
    student_pw = generate_password_hash("12345678")
    supervisor_pw = generate_password_hash("12345678")
    existing = query_db("SELECT id FROM users WHERE email = %s", ("w.saqib@student.nu.edu.pk",), one=True)
    if not existing:
        query_db("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)", ("M. Waqas", "w.saqib@student.nu.edu.pk", student_pw, "student"), commit=True)
    existing = query_db("SELECT id FROM users WHERE email = %s", ("tahir@faculty.nu.edu.pk",), one=True)
    if not existing:
        query_db("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)", ("Dr. Tahir", "tahir@faculty.nu.edu.pk", supervisor_pw, "supervisor"), commit=True)
    for name, email, role in (
        ("Ayesha Khan", "ayesha@student.nu.edu.pk", "student"),
        ("Dr. Sana Riaz", "sana@faculty.nu.edu.pk", "supervisor"),
        ("Coordinator Office", "coordinator@nu.edu.pk", "coordinator"),
    ):
        if not query_db("SELECT id FROM users WHERE email = %s", (email,), one=True):
            query_db("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                     (name, email, generate_password_hash("12345678"), role), commit=True)
    print("Database initialized and demo users seeded.")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "FYPilot backend is running"}), 200

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = clean_str(data.get("name"), 3, 60)
    email = clean_str(data.get("email"), 5, 100)
    password = data.get("password")
    if not name or not email or not isinstance(password, str):
        return bad("Name, email, and password are required")
    email = email.lower()
    if not EMAIL_RE.match(email):
        return bad("Please provide a valid email address")
    if len(password) < 8 or len(password) > 72:
        return bad("Password must be 8-72 characters")
    # SECURITY: role is NEVER taken from the client. Self-registration is always a student.
    role = "student"
    existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing:
        return bad("Email already registered", 409)
    password_hash = generate_password_hash(password)
    query_db("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)", (name, email, password_hash, role), commit=True)
    user = query_db("SELECT id, name, email, role FROM users WHERE email = %s", (email,), one=True)
    access_token = create_access_token(identity=str(user["id"]))
    return jsonify({"message": "Registration successful", "user": dict(user), "access_token": access_token}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = clean_str(data.get("email"), 1, 100)
    password = data.get("password")
    if not email or not isinstance(password, str) or not password:
        return bad("Email and password are required")
    email = email.lower()
    user = query_db("SELECT * FROM users WHERE email = %s", (email,), one=True)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    access_token = create_access_token(identity=str(user["id"]))
    return jsonify({"message": "Login successful", "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}, "access_token": access_token}), 200

@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = query_db("SELECT id, name, email, role, created_at FROM users WHERE id = %s", (user_id,), one=True)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": dict(user)}), 200

@app.route("/api/funding", methods=["GET"])
@jwt_required()
def get_funding():
    user_id = get_jwt_identity()
    user_role = query_db("SELECT role FROM users WHERE id = %s", (user_id,), one=True)["role"]
    if user_role == "supervisor":
        rows = query_db("SELECT fr.id, fr.title, fr.amount, fr.purpose, fr.status, fr.created_at, u.name AS student_name, u.email AS student_email FROM funding_requests fr JOIN users u ON fr.student_id = u.id ORDER BY fr.created_at DESC")
    else:
        rows = query_db("SELECT id, title, amount, purpose, status, created_at FROM funding_requests WHERE student_id = %s ORDER BY created_at DESC", (user_id,))
    return jsonify({"funding": [dict(r) for r in rows]}), 200

@app.route("/api/funding", methods=["POST"])
@jwt_required()
def create_funding():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    title = clean_str(data.get("title"), 3, 80)
    purpose = clean_str(data.get("purpose"), 3, 300)
    try:
        amount = int(data.get("amount"))
    except (ValueError, TypeError):
        return bad("Amount must be a valid number")
    if not title or not purpose:
        return bad("Title (3-80 chars) and purpose (3-300 chars) are required")
    if amount <= 0 or amount > 10_000_000:
        return bad("Amount must be between 1 and 10,000,000")
    query_db("INSERT INTO funding_requests (title, amount, purpose, status, student_id) VALUES (%s, %s, %s, %s, %s)", (title, amount, purpose, "Pending", user_id), commit=True)
    new_id = query_db("SELECT currval(pg_get_serial_sequence('funding_requests', 'id')) AS id", one=True)["id"]
    return jsonify({"message": "Funding request submitted successfully", "id": new_id, "status": "Pending"}), 201

@app.route("/api/funding/<int:req_id>", methods=["PUT"])
@jwt_required()
def update_funding(req_id):
    user_id = get_jwt_identity()
    user_role = query_db("SELECT role FROM users WHERE id = %s", (user_id,), one=True)["role"]
    if user_role != "supervisor":
        return jsonify({"error": "Only supervisors can approve/reject funding requests"}), 403
    data = request.get_json(silent=True) or {}
    status = clean_str(data.get("status"), 1, 20)
    if status not in ("Approved", "Rejected"):
        return jsonify({"error": "Status must be 'Approved' or 'Rejected'"}), 400
    existing = query_db("SELECT id FROM funding_requests WHERE id = %s", (req_id,), one=True)
    if not existing:
        return jsonify({"error": "Funding request not found"}), 404
    query_db("UPDATE funding_requests SET status = %s WHERE id = %s", (status, req_id), commit=True)
    return jsonify({"message": "Funding request " + status.lower() + " successfully"}), 200
@app.route("/api/archive", methods=["GET"])
@jwt_required()
def get_archive():
    search = request.args.get("search", "").strip()
    category = request.args.get("category", "all").strip()
    query = "SELECT id, title, year, category, supervisor, similarity, summary FROM archive_projects WHERE 1=1"
    args = []
    if search:
        query += " AND (title ILIKE %s OR summary ILIKE %s)"
        args.extend([("%" + search + "%"), ("%" + search + "%")])
    if category != "all":
        query += " AND category = %s"
        args.append(category)
    query += " ORDER BY year DESC, title ASC"
    rows = query_db(query, tuple(args))
    return jsonify({"archive": [dict(r) for r in rows]}), 200

@app.route("/api/archive/<int:proj_id>", methods=["GET"])
@jwt_required()
def get_archive_detail(proj_id):
    row = query_db("SELECT id, title, year, category, supervisor, similarity, summary FROM archive_projects WHERE id = %s", (proj_id,), one=True)
    if not row:
        return jsonify({"error": "Archive project not found"}), 404
    return jsonify(dict(row)), 200

@app.route("/api/archive", methods=["POST"])
@jwt_required()
def create_archive():
    user_id = get_jwt_identity()
    user_role = query_db("SELECT role FROM users WHERE id = %s", (user_id,), one=True)["role"]
    if user_role not in ("supervisor", "coordinator", "library"):
        return jsonify({"error": "Only supervisors, coordinators, or library staff can add archive entries"}), 403
    data = request.get_json(silent=True) or {}
    title = clean_str(data.get("title"), 3, 200)
    category = clean_str(data.get("category"), 2, 50)
    supervisor = clean_str(data.get("supervisor"), 2, 100)
    summary = clean_str(data.get("summary"), 3, 1000)
    similarity = clean_str(data.get("similarity", "low"), 1, 20)
    try:
        year = int(data.get("year"))
    except (ValueError, TypeError):
        return bad("Year must be a valid number")
    if not (title and category and supervisor and summary):
        return bad("Title, category, supervisor and summary are required (check lengths)")
    if year < 2000 or year > 2100:
        return bad("Year must be between 2000 and 2100")
    if similarity not in VALID_SIMILARITY:
        return bad("Similarity must be low, medium or high")
    query_db("INSERT INTO archive_projects (title, year, category, supervisor, similarity, summary) VALUES (%s, %s, %s, %s, %s, %s)", (title, year, category, supervisor, similarity, summary), commit=True)
    return jsonify({"message": "Archive entry added successfully"}), 201

@app.route("/api/dashboard/stats", methods=["GET"])
@jwt_required()
def dashboard_stats():
    user_id = get_jwt_identity()
    user_role = query_db("SELECT role FROM users WHERE id = %s", (user_id,), one=True)["role"]
    if user_role == "student":
        funding_count = query_db("SELECT COUNT(*) as c FROM funding_requests WHERE student_id = %s", (user_id,), one=True)["c"]
        pending_count = query_db("SELECT COUNT(*) as c FROM funding_requests WHERE student_id = %s AND status = %s", (user_id, "Pending"), one=True)["c"]
        return jsonify({"role": "student", "funding_requests": funding_count, "pending_requests": pending_count, "milestone": "Mid-Evaluation", "progress": 33}), 200
    else:
        total_funding = query_db("SELECT COUNT(*) as c FROM funding_requests", one=True)["c"]
        pending_funding = query_db("SELECT COUNT(*) as c FROM funding_requests WHERE status = %s", ("Pending",), one=True)["c"]
        total_students = query_db("SELECT COUNT(*) as c FROM users WHERE role = %s", ("student",), one=True)["c"]
        return jsonify({"role": user_role, "total_funding_requests": total_funding, "pending_funding_requests": pending_funding, "total_students": total_students}), 200

@app.route("/api/dashboard/notifications", methods=["GET"])
@jwt_required()
def dashboard_notifications():
    user_id = get_jwt_identity()
    rows = query_db("SELECT id, 'Funding request #' || CAST(fr.id AS TEXT) || ' is now ' || fr.status AS message, fr.created_at AS created_at, false AS read FROM funding_requests fr WHERE fr.student_id = %s AND fr.status != 'Pending' UNION ALL SELECT id, 'New archive project added: ' || ap.title AS message, ap.created_at, false AS read FROM archive_projects ap ORDER BY created_at DESC LIMIT 10", (user_id,))
    return jsonify({"notifications": [dict(r) for r in rows]}), 200

def bootstrap():
    """Create tables (and demo users) on startup. Runs under gunicorn AND python app.py."""
    try:
        with app.app_context():
            init_db()
    except Exception:
        # Do not crash the server: /api/health must still answer so the problem is visible in the logs.
        app.logger.exception("Database initialisation failed - check DATABASE_URL")


bootstrap()

if __name__ == "__main__":
    # Local development only. In production Render runs: gunicorn app:app
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)