-- =====================================================================
-- FYPilot — Activity 7 schema
-- Secure grant-request workflow: server-validated sessions, owner-scoped
-- records, a constrained state machine, optimistic locking and an audit
-- trail. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Server-side sessions
--    A JWT alone cannot be revoked. Every issued token carries a jti that
--    must match a live row here, so logout can invalidate a credential
--    server-side and a replayed token is rejected.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    jti             UUID        PRIMARY KEY,
    user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    access_expires  TIMESTAMPTZ NOT NULL,
    session_expires TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions (user_id);

-- ---------------------------------------------------------------------
-- 2. Grant requests (the workflow record)
--    owner_id, status and all timestamps are server-controlled. The CHECK
--    constraints repeat the API validation so that a bad row cannot be
--    written even by a direct SQL client.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grant_requests (
    id          BIGSERIAL    PRIMARY KEY,
    reference   VARCHAR(24)  NOT NULL UNIQUE,
    owner_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(120) NOT NULL,
    description TEXT         NOT NULL,
    category    VARCHAR(20)  NOT NULL,
    amount      INTEGER      NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    version     INTEGER      NOT NULL DEFAULT 1,
    claimed_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    claimed_at  TIMESTAMPTZ,
    decided_at  TIMESTAMPTZ,
    decision_note TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_grant_title_len  CHECK (char_length(btrim(title)) >= 5),
    CONSTRAINT ck_grant_desc_len   CHECK (char_length(btrim(description)) >= 15),
    CONSTRAINT ck_grant_category   CHECK (category IN ('hardware','cloud','api','travel','other')),
    CONSTRAINT ck_grant_status     CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
    CONSTRAINT ck_grant_amount     CHECK (amount > 0 AND amount <= 10000000),
    CONSTRAINT ck_grant_version    CHECK (version >= 1),
    -- A decided record must record who decided it and when.
    CONSTRAINT ck_grant_decided    CHECK (
        (status IN ('APPROVED','REJECTED')) = (decided_at IS NOT NULL)
    ),
    -- Review and decision states must have a claimant.
    CONSTRAINT ck_grant_claimed    CHECK (
        status NOT IN ('UNDER_REVIEW','APPROVED','REJECTED') OR claimed_by IS NOT NULL
    )
);

-- Race-safe duplicate prevention. Enforced by the database, not by a
-- read-then-write check in application code, so two concurrent requests
-- cannot both pass. Partial: a withdrawn/rejected title may be reused.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grant_open_title
    ON grant_requests (owner_id, lower(btrim(title)))
    WHERE status IN ('PENDING','UNDER_REVIEW');

CREATE INDEX IF NOT EXISTS ix_grant_owner  ON grant_requests (owner_id);
CREATE INDEX IF NOT EXISTS ix_grant_status ON grant_requests (status);

-- ---------------------------------------------------------------------
-- 3. Audit trail
--    Append-only history: actor, record, action, time. Written inside the
--    same transaction as the change it describes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grant_audit (
    id          BIGSERIAL    PRIMARY KEY,
    grant_id    BIGINT       NOT NULL REFERENCES grant_requests(id) ON DELETE CASCADE,
    actor_id    INTEGER      NOT NULL REFERENCES users(id),
    actor_role  VARCHAR(20)  NOT NULL,
    action      VARCHAR(24)  NOT NULL,
    from_status VARCHAR(20),
    to_status   VARCHAR(20),
    detail      VARCHAR(200),
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_audit_action CHECK (action IN ('CREATED','CLAIMED','FINALIZED','WITHDRAWN'))
);

CREATE INDEX IF NOT EXISTS ix_audit_grant ON grant_audit (grant_id, occurred_at);

-- The audit trail is append-only: block UPDATE and DELETE at the database
-- level so history cannot be rewritten by application code or by a client
-- with a database connection.
CREATE OR REPLACE FUNCTION grant_audit_is_append_only() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'grant_audit is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grant_audit_no_update ON grant_audit;
CREATE TRIGGER trg_grant_audit_no_update
    BEFORE UPDATE OR DELETE ON grant_audit
    FOR EACH ROW EXECUTE FUNCTION grant_audit_is_append_only();
