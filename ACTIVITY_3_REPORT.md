# FYPilot — Activity 3: Submission & Verification Report

**SSD Development Activity 3 — Parallel Module Development & Integration** · FAST NUCES Chiniot-Faisalabad
**Group Members:** M. Waqas (23F-3041)
**Project:** FYPilot (same project as Activities 1 & 2)

> Note: the group consists of a single member (M. Waqas), so both modules were developed by the same
> member and then integrated into the existing prototype. All files remain in one folder and run locally
> without an internet connection or backend.

---

## 1. Submission information

| Field | Answer |
| --- | --- |
| Project Name | FYPilot |
| Group Members | M. Waqas (23F-3041) |
| Module 1 | Submit Proposal & Funding Request |
| Module 2 | FYP Archive Browser |
| Module 1 functionality implemented | Validated form that stores each submission in a JavaScript array, shows a live “My Requests” list with status + success/error feedback |
| Module 2 functionality implemented | Search & filter over a sample archive stored in a JavaScript array, with a project details view |
| JavaScript interactions implemented | 1. Module 1 — validated submission → array → live list re-render + toast · 2. Module 2 — live case-insensitive search + category filter + details modal |
| One problem discovered during testing | Module 1: the submit action kept a stale disabled/validation state until a field was edited; Module 2: search only matched the start of titles and was case-sensitive |
| How it was corrected | Module 1: validation state now clears on every keystroke and submission re-renders the list instantly · Module 2: search is now case-insensitive substring matching over title + summary |

---

## 2. Modules & responsibilities (Part 1)

| Module | Responsibility |
| --- | --- |
| **Module 1 — Submit Proposal & Funding Request** (`module1.html`) | A student submits an FYP proposal title and a funding request (amount + purpose). Input is validated, stored in a JavaScript array, and shown in a live list with “Pending” status and feedback. |
| **Module 2 — FYP Archive Browser** (`module2.html`) | A student browses a sample archive of past FYPs, searches by keyword and filters by category, and opens a project’s details view. |

## 3. Per-module feature checklist (Parts 2 & 3)

| Requirement | Module 1 | Module 2 |
| --- | --- | --- |
| Clean user interface | ✅ | ✅ |
| Primary task / action | ✅ submit request → added to JS array | ✅ list, search and filter the sample archive |
| Input validation | ✅ title ≥3 chars · amount 4–7 digits · purpose ≥5 chars | ✅ search rule: case-insensitive substring over title + summary |
| Meaningful JavaScript interaction(s) | ✅ add-to-array + live re-render + toast | ✅ live search + filter + details modal |
| Feedback (success & invalid) | ✅ inline errors + success toast | ✅ result count + “no results” state + details view |
| Sample data in JS array | ✅ `requests = [{id, title, amount, purpose, status}]` | ✅ `archive = [{id, title, year, cat, sup, sim, sum}]` |

**Input validation / search rule:** Module 1 — amount must be numeric (4–7 digits) and purpose ≥ 5 characters;
Module 2 — search matches case-insensitively against the project title and summary.

## 4. Integration checklist (Part 4)

| Check | Status |
| --- | --- |
| Both modules in the same project folder | ✅ (`module1.html`, `module2.html` next to the other pages) |
| Both modules linked from the project interface | ✅ a “Modules” section on the student dashboard links to both |
| Users can move between main interface ↔ M1 ↔ M2 | ✅ header navigation on all module pages + dashboard tiles |
| Consistent headings, navigation, buttons, fonts, styling | ✅ same design system and components |
| File names and local links correct | ✅ verified (no broken links) |
| Existing functionality from Activities 1 & 2 still works | ✅ login/roles/dashboards regression-tested with the modules present |

## 5. Testing results (Part 5) — automated, headless Chromium

**Module 1 — Submit Proposal & Funding Request**
| Test case | Expected result | Actual result |
| --- | --- | --- |
| Submit a valid request (PKR 25000 + purpose) | The action succeeds | ✅ appears in “My Requests”, count updates, success toast |
| Leave required fields empty | System prevents submission / shows error | ✅ blocked with inline errors, list unchanged |
| Enter an invalid amount (e.g., “12a”) | Blocked with an error | ✅ error shown, nothing added |
| Perform a second action (submit another request) | The interface updates | ✅ list grows to 3 items |

**Module 2 — FYP Archive Browser**
| Test case | Expected result | Actual result |
| --- | --- | --- |
| Search a valid keyword (e.g., “phish”) | Matching items shown | ✅ 1 result (PhishGuard), case-insensitive |
| Leave the search box empty | Full list shown | ✅ all 7 sample projects listed |
| Perform a second action (filter after search) | The interface updates | ✅ filter narrows list live; details modal opens |

**Automated suite: 18/18 assertions passed** (integration tiles, M1 submit/validation/live list, M2 search/filter/details, module guard without session).

**Issues discovered during testing:**
- Module 1: stale validation/button state after an error until the field was edited → **Correction:** validation clears on keystroke and submission re-renders instantly.
- Module 2: search was case-sensitive and matched only the start of titles → **Correction:** case-insensitive substring search over title + summary.

## 6. Security-aware development (Part 6)

| Module | Possible misuse / problem | Proposed response |
| --- | --- | --- |
| Module 1 | Submitting an unrealistic/negative amount or fake roll data | Amount format checked (4–7 digits) and purpose required; invalid input rejected with inline messages. Front-end only — backend re-validation in a later phase. |
| Module 2 | Attempting to view full archive documents / private reports | Only titles, summaries, year and a similarity tier are rendered; full documents stay restricted; user input is escaped. Backend enforcement planned. |

## 7. Screenshots (deliverable 3)

Saved in the **`screenshots/`** folder:
- `screenshots/module1-desktop.png` — Module 1 (desktop)
- `screenshots/module1-mobile.png` — Module 1 (mobile)
- `screenshots/module2-desktop.png` — Module 2 (desktop)
- `screenshots/module2-mobile.png` — Module 2 (mobile)

## 8. Deliverables checklist
| # | Deliverable | Status |
| --- | --- | --- |
| 1 | Updated project source code (HTML/CSS/JS in one folder, works offline) | ✅ |
| 2 | Both functional modules integrated into the existing project | ✅ |
| 3 | Screenshots showing each module | ✅ `screenshots/` |
| 4 | Completed testing and security-awareness notes | ✅ this report |

---
© 2026 FYPilot — FAST NUCES Chiniot-Faisalabad | Navigate Your Final Year.
