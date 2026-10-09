# FYPilot — Activity 2: Submission & Verification Report

**SSD Development Activity 2 — Build a Role-Based Functional Prototype** · FAST NUCES Chiniot-Faisalabad
**Group:** M. Zain (22F-3645) · M. Waqas (23F-3041) · M. Taqi (23F-3026)
**Project:** FYPilot (same project as Activity 1)

---

## 1. Submission form (ready to copy)

| Field | Answer |
| --- | --- |
| Project Name | FYPilot |
| Group Members | M. Zain (22F-3645), M. Waqas (23F-3041), M. Taqi (23F-3026) |
| Primary User Role (Activity 1) | Student |
| Roles Implemented | Student, Supervisor |
| Restricted Function | Approve project funding requests (Supervisor only) |
| Security Concept Applied | Role-Based Access Control (RBAC) + information masking (least-privilege display) |

---

## 2. Part-by-part answers

### Part 1 — Two user roles
- Role 1: **Student** (M. Waqas, 23F-3041)
- Role 2: **Supervisor** (Dr. Tahir)

### Part 2 — What each role can do (>=3 functions)
| Role | Functions |
| --- | --- |
| Student | 1. Upload deliverables (proposal, report, presentation) · 2. Check proposal originality against 1,240+ past FYPs · 3. Request funding and track approval · 4. View grades, panel feedback and milestone progress |
| Supervisor | 1. View assigned groups and milestone progress · 2. Grade deliverables with a rubric and notify students · 3. Approve/reject funding requests · 4. Post feedback to the group |

### Part 3 — Demo users
| User | Name | Role | Login |
| --- | --- | --- | --- |
| User 1 | M. Waqas | Student | w.saqib@student.nu.edu.pk / 12345678 |
| User 2 | Dr. Tahir | Supervisor | tahir@faculty.nu.edu.pk / 12345678 |

*(No database — identity is simulated in JavaScript sessionStorage.)*

### Part 4 — Functional login
Flow: Login → Identify User → Identify Role → Display appropriate dashboard.
- Student → dashboard.html
- Supervisor → supervisor.html
- Panelist / Coordinator / Library → roles.html (role-preview screen)

### Part 5 — Role-specific dashboards
- Student dashboard: upload, originality check, funding request, grades/feedback, milestones, archive.
- Supervisor dashboard (supervisor.html): assigned groups, rubric grading, funding approvals, feedback, milestones, protected contacts, audit log. Both dashboards include Logout.

### Part 6 — Test the difference between the roles
| User | Functions seen |
| --- | --- |
| Student | student-only functions; staff actions are locked (Access Denied) |
| Supervisor | supervisor functions (approve/reject, rubric grading, full contacts) |

### Part 7 — Restricted function
- **Function:** Approve project funding requests — **Supervisor only**.
- Pseudocode:
```
IF user.role = "supervisor"
    perform: update status to Approved, log the action, notify group
ELSE
    display "Access Denied"
END IF
```
- Students see a locked “Staff-Only Actions” card; every guarded button raises the Access Denied banner + toast. The same buttons work on the supervisor dashboard.

### Part 8 — One security-aware data display
- **Selected info:** detailed rubric scores & internal panel notes, and group members’ personal contact / CNIC.
- **How displayed:** students see final score + public comments only; full rubric detail and full PII render only on the supervisor dashboard; students see masked values (e.g., 0300-••••••5).

### Part 9 — Logout
- Avatar menu → Logout clears sessionStorage (fypilot_session) → returns to login.html.
- Guard: dashboard/supervisor/roles pages redirect to login when no valid session; wrong-role users are redirected to their own home.

### Part 10 — Test results (automated, headless Chromium)
| Test | Result |
| --- | --- |
| Test 1 — Correct role (login as Student) | PASS — student dashboard shown |
| Test 2 — Different role (login as Supervisor) | PASS — supervisor dashboard shown |
| Test 3 — Restricted function with wrong role | PASS — Access Denied banner/toast, no change |
| Test 4 — Logout | PASS — session cleared, returned to login, pages guarded |

Automated suite: **19/19 assertions passed** (login routing, demo autofill, denied banner, logout + session cleared, supervisor approve/deny, live rubric total, flex export reveal, wrong-role redirect, no-session redirect).

### Part 11 — Security development note
| Question | Answer |
| --- | --- |
| Security concept applied | Role-Based Access Control (RBAC) + data masking / least-privilege display |
| Where did you apply it? | 1. Login detects the role and routes to the correct dashboard. 2. requireRole() guards every protected page. 3. Funding approval and other staff actions execute only for the authorised role. 4. Internal rubric notes and full PII are supervisor-only; PII is masked elsewhere. 5. Logout clears the session so protected screens cannot be reopened. |
| How does it protect the information? | Every restricted action checks the session role before executing (wrong role → Access Denied). Sensitive data is rendered only for the role that needs it, and masked for all others, reducing exposure even during demos. Clearing the session on logout prevents the next person on the same device from viewing protected screens. (Prototype note: enforcement is client-side; the backend will enforce RBAC + JWT + API authorisation later.) |

---
© 2026 FYPilot — FAST NUCES Chiniot-Faisalabad | Navigate Your Final Year.
