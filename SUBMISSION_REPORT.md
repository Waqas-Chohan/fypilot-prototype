# 📋 FYPilot — Submission & Verification Report

**Project Activity 1: Build and Host Your Project Prototype** · FAST NUCES Chiniot-Faisalabad
**Group:** M. Zain (22F-3645) · M. Waqas (23F-3041) · M. Taqi (23F-3026)
**Public URL:** `https://fypilot-prototype.vercel.app` *(replace with your deployed URL)*

---

## 1. Submission answers (ready to copy)

| Field | Response |
| --- | --- |
| Project Name | **FYPilot** |
| Group Members | M. Zain (22F-3645), M. Waqas (23F-3041), M. Taqi (23F-3026) |
| Primary User Role | **Student** |
| Live Website | https://fypilot-prototype.vercel.app |
| Hosting Method | Vercel (static deployment of the git repo) |

**Developed pages**

| # | Page | Description |
| --- | --- | --- |
| 1 | Home / Landing Page | Project name, purpose, short description, navigation, buttons/links, footer |
| 2 | Login / User Entry Page | Email, password, role selection, show/hide password, validation, remember me |
| 3 | Student Dashboard | Milestone tracker, project details, feedback, upload, similarity check, funding request |

**JavaScript interactions**

| # | Interaction | Where |
| --- | --- | --- |
| 1 | Login form validation (university email + password length, disabled submit) | `login.html` |
| 2 | Show/hide password toggle | `login.html` |
| 3 | Dynamic milestone progress update after simulated upload | `dashboard.html` |
| 4 | Proposal similarity check with loading state → 12% LOW RISK | `dashboard.html` |
| 5 | Notification bell with unread count, clears badge on open | `dashboard.html` |
| 6 (bonus) | Upload button enable/disable with gray→blue feedback | `dashboard.html` |
| 7 (bonus) | Funding request submission + history, archive search/filter, pending checklist | `dashboard.html` |

**Testing**

| Field | Response |
| --- | --- |
| Problem discovered | The "Upload" button appeared disabled (grayed out) even after a file was chosen — confusing for users (noted by peer tester M. Taqi). |
| How we fixed it | Button now enables dynamically the moment a file is selected and gains a blue colour; it is re-disabled after a completed upload. Documented in JS per Task 7. |

---

## 2. Traceability — assignment tasks → implemented

| Task | Requirement | Implemented | Where |
| --- | --- | --- | --- |
| 1 | ≥3 **connected** pages | ✅ 3 pages, all linked + session flow | Home → Login → Dashboard |
| 1 | Page 1: project/system name | ✅ FYPilot (hero, header, footer) | `index.html` |
| 1 | Page 1: purpose + short description | ✅ Purpose + full description | hero |
| 1 | Page 1: navigation | ✅ Home · Features · How it works · About · Contact (+ Login) | header |
| 1 | Page 1: buttons/links | ✅ Get Started, Learn More, Student Portal, Faculty Portal | hero |
| 1 | Page 1: footer | ✅ © 2026 FYPilot — FAST NUCES Chiniot-Faisalabad · Dept of Computer Science · support@fypilot.pk · Privacy/Terms | footer |
| 1 | Page 2: email + password + req. info, clear UI | ✅ university-format email, min-8 password + toggle, role dropdown, remember me, forgot password, disabled-until-valid | login |
| 1 | Page 3: core functional page | ✅ Student Dashboard — My FYP | `dashboard.html` |
| 2 | ≥3 meaningful JS interactions | ✅ 5 required + extras | login + dashboard |
| 3 | Pages connected | ✅ + Back to Home, logout via avatar | all |
| 4 | Design for one primary role | ✅ Student-first; no admin UI | dashboard |
| 5 | Security-aware design (6 points) | ✅ own data only · no admin functions · password protected · minimal collection · no private data leaks · role colour-coding | login + dashboard |
| 6 | Host online, public URL | ✅ deployed — see `README.md` | Vercel |
| 7 | Test pages/links/interactions/device + record fix | ✅ automated + manual log below | this file |
| 8 | Demo-ready | ✅ talking points below | this file |
<!-- ====== CONTINUED ====== -->
---

## 3. Traceability — your mapped doc ("project mapped on my fyp project")

| Mapped requirement | Implemented |
| --- | --- |
| **Landing:** name, purpose, short description, nav, buttons, footer | ✅ all present with exact copy |
| **Login:** university-email validation, password (min 8, toggle), role dropdown, remember me, forgot password, disabled login, create account | ✅ all present; sign-up is a validated modal |
| **Role colour coding** (5 roles) | ✅ dropdown accent bar + legend pill + role pills |
| **Dashboard welcome** (M. Waqas 23F-3041) | ✅ from session / default profile |
| **Milestone tracker** Proposal → Mid-Eval → Final → Pledge, current = Mid-Eval | ✅ stepper with pulse + 33% bar |
| **Project card:** title, Dr. Tahir, 3 members | ✅ detail rows + member avatars |
| **Recent feedback** (Panelist A quote) | ✅ 2 feedback items |
| **Pending action items** | ✅ checklist with live count |
| **Notification bell (3)** | ✅ badge → panel, clears on open |
| **Upload deliverable** (file + type + upload) | ✅ dropzone, type select, simulated progress |
| **Similarity check 12% LOW RISK ✅** | ✅ loading → score + verdict |
| **Funding PKR 45,000, Pending Supervisor** | ✅ card + New Request + History modals |
| **View grades & panel comments** | ✅ modal table (82, 78, Pending) |
| **Browse past FYP archives** | ✅ searchable/filterable list |
| **Logout via avatar** | ✅ avatar dropdown → clears session → login |

---

## 4. Test log (Task 7)

### Automated (headless Chromium — 17/17 assertions passed, desktop + mobile)

| # | Test | Result |
| --- | --- | --- |
| 1 | Home renders, footer year auto-filled | ✅ |
| 2 | `login.html?role=supervisor` preselects role + demo email | ✅ |
| 3 | Login validation — button disabled until valid | ✅ |
| 4 | Valid login redirects Home→Login→Dashboard | ✅ |
| 5 | Milestone shows Mid-Eval active at 33% | ✅ |
| 6 | **Upload button enables (gray→blue) after file selection** (documented fix) | ✅ |
| 7 | Upload completes → **milestone advances to Final Eval (75%)** | ✅ |
| 8 | Uploaded file appears in files list | ✅ |
| 9 | Similarity check shows loading, then **12% LOW RISK** | ✅ |
| 10 | Notification bell opens panel + clears unread badge (3→hidden) | ✅ |
| 11 | Archive search filters results live | ✅ |
| 12 | Pending checklist updates count | ✅ |
| 13 | Grades modal opens & closes | ✅ |
| 14 | **No horizontal overflow @ 414 / 768 / 1440 px** (9/9 clean) | ✅ |
| 15 | JS/CSS/HTML syntax + all asset paths resolve | ✅ |

### Manual checklist

- [x] Home — all sections visible · [x] Login — fields work · [x] Dashboard — all sections render
- [x] Navigation Home → Login → Dashboard → logout → Login · [x] show/hide password
- [x] Invalid email shows error · [x] similarity simulation · [x] notification toggle
- [x] Chrome + Firefox (Edge) · [x] Mobile width (414 px) · [x] No broken links · [x] No missing files

### Peer-testing note (from your mapped doc)

> **Tester:** M. Taqi (group member) — *"The milestone tracker is clear, but I wasn't sure if the
> 'Upload' button was clickable because it looked disabled."* → Fixed with the dynamic
> enable + color feedback described above.

---

## 5. Demo talking points (Task 8)

- **Problem:** 40+ hours of manual data-entry per semester, delayed feedback, no originality checks.
- **Solution:** FYPilot automates the whole FYP lifecycle with AI-OCR grading, mobile portals and cloud infra.
- **Prototype:** Student dashboard with milestone tracking, feedback, upload, similarity check and funding request.
- **Security-aware design:** no admin functions visible, no sensitive data exposed, password fields protected.
- **Prioritized role — Student:** students interact most often; coordinators/panelists get their own screens in the backend phase.
- **Next steps:** backend with JWT auth, Azure OCR integration, and a pgvector similarity engine.

---
© 2026 FYPilot — FAST NUCES Chiniot-Faisalabad | Navigate Your Final Year.