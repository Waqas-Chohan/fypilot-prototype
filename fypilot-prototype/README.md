# 🎓 FYPilot — Project Activity 1: Build & Host Your Project Prototype

> **Navigate Your Final Year.** A mobile-first platform that automates the complete Final Year
> Project (FYP) lifecycle at FAST NUCES — from proposal submission to library archiving.

**Group:** M. Zain (22F-3645) · M. Waqas (23F-3041) · M. Taqi (23F-3026)
**Primary user role:** Student
**Supervisor:** Dr. Tahir

---

## 📁 What's inside

| Path | Description |
| --- | --- |
| `index.html` | Home / Landing page — name, purpose, description, navigation, CTAs, footer |
| `login.html` | Login / User Entry — university-email validation, show/hide password, colour-coded role selection, remember me, sign-up + forgot-password modals |
| `dashboard.html` | Student Dashboard (core functional page) — milestone tracker, feedback, upload, originality check, funding, archive, notifications |
| `assets/css/styles.css` | Full design system (CSS variables, components, responsive, accessible) |
| `assets/js/main.js` | Shared: mobile nav, toasts, modals, dropdowns, reveal-on-scroll, contact form |
| `assets/js/login.js` | Login validation + simulated authentication + session handoff |
| `assets/js/dashboard.js` | Upload → dynamic milestone update, similarity check, notifications, funding, archive search |
| `assets/img/` | Logo + favicon (self-contained) |
| `SUBMISSION_REPORT.md` | Requirement→feature traceability, test log, demo talking points |

**Tech:** pure HTML5 · CSS3 · Vanilla JavaScript — zero build step, zero dependencies.
Works offline (double-click `index.html`) and on any static host.

---

## ▶️ Run locally

**Option A — double click:** open `index.html` in any browser. All pages are linked relatively,
so file:// works.

**Option B — local server (recommended):**

```bash
# from inside the fypilot-prototype folder
python -m http.server 8080
# open http://localhost:8080
```

Try the demo login: `w.saqib@student.nu.edu.pk` / `12345678` (any valid university email +
8-char password works — it's a prototype).

---

## 🚀 Deploy on Vercel (detailed step-by-step)

### Step 1 — Create your GitHub repository

1. Go to https://github.com and sign in.
2. Click the **+** (top right) → **New repository**.
3. Repository name: **`fypilot-prototype`** (public or private — either works for Vercel).
4. Do **not** tick "Add a README" / ".gitignore" (you already have these files).
5. Click **Create repository**.

### Step 2 — Push these files to GitHub

Open a terminal in the **`fypilot-prototype`** folder and run:

```bash
git init
git add .
git commit -m "FYPilot prototype — Project Activity 1"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/fypilot-prototype.git
git push -u origin main
```

> Replace `<YOUR-USERNAME>` with your GitHub username. If you already created the repo on
> GitHub with different instructions, simply commit and push these files into it.

### Step 3 — Import the project into Vercel

1. Go to https://vercel.com and sign in (GitHub sign-in is fastest).
2. Click **Add New → Project**.
3. Choose **`fypilot-prototype`** from the GitHub repository list (click **Import**).
   - If the repo doesn't appear: click **Adjust GitHub App Permissions** / install the Vercel
     GitHub app and grant access to the repo.
4. **Framework Preset:** Vercel auto-detects **Other** (static site). Leave everything as-is —
   no build command, no output directory.
5. Click **Deploy**. Wait ~30 seconds.

### Step 4 — Get your public URL

Vercel gives you a URL like **`https://fypilot-prototype.vercel.app`**.

- Click **Domains** in the project dashboard to add a custom domain or rename the subdomain.
- That URL is what you submit in the activity.

### Step 5 — Test your live site

1. Open the public URL on your phone **and** desktop.
2. Run the flow **Home → Login → Student Dashboard**.
3. Try: password show/hide · invalid email error · upload a file (watch the milestone update) ·
   "Check My Proposal" (loading → 12% LOW RISK) · notification bell → upload button enabling.
4. Confirm no broken links (use the in-page footer + navigation).

### Alternative hosts (one-click equivalent)

- **Netlify:** https://app.netlify.com/drop → drag the folder onto the page → instant URL.
- **GitHub Pages:** Settings → Pages → deploy branch `main` from repo root → `https://<user>.github.io/fypilot-prototype`.

---

## ✅ Feature checklist vs. activity tasks

- [x] **Task 1** — 3 connected pages (Home, Login, Student Dashboard)
- [x] **Task 2** — 5+ JavaScript interactions (validation, show/hide password, dynamic milestone
      update, similarity loading, notification badge, upload enable/disable, archive search…)
- [x] **Task 3** — pages connected: Home → Login → Dashboard → logout → Login
- [x] **Task 4** — designed around the primary **Student** role
- [x] **Task 5** — security-aware design (no admin UI, own data only, password protected,
      minimal collection, role colour-coding)
- [x] **Task 6** — hosted online under a public URL
- [x] **Task 7** — every page/link/interaction tested; one problem discovered & fixed
- [x] **Task 8** — demo-ready (see `SUBMISSION_REPORT.md` talking points)

---
© 2026 FYPilot — FAST NUCES Chiniot-Faisalabad · Department of Computer Science ·
support@fypilot.pk · Privacy Policy | Terms of Use