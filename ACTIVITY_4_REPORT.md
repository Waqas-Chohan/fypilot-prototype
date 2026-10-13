# FYPilot — Activity 4: Dependency Mapping & Failure Analysis

**SSD Development Activity 4** · FAST NUCES Chiniot-Faisalabad · **Group Members:** M. Waqas (23F-3041)
Full write-up (all 7 parts, tests, screenshots): `FYPilot_Activity4_Dependency_Mapping_and_Failure_Analysis.docx`
Live view of the matrix, graph and impact simulator: `status.html`

## 1. Components
| Symbol | Component | Files | Main responsibility |
| --- | --- | --- | --- |
| C1 | Landing Page | index.html | Public entry point, links to login, contact form |
| C2 | Authentication Module | login.html, login.js | Validates credentials, identifies role, creates session, routes to dashboard |
| C3 | Bot-Verification Service | Cloudflare Turnstile + worker.js | Human check before sign-in, server-side token verification |
| C4 | Shared UI Core | main.js (UI helpers) | Toasts, modals, menus, HTML escaping, debounce |
| C5 | Session & Access Control | main.js (session helpers) + sessionStorage | getSession, requireRole guard, logout |
| C6 | Student Dashboard | dashboard.html/js | Milestones, uploads, originality, funding, grades |
| C7 | Supervisor Dashboard | supervisor.html/js | Approvals (restricted), grading, feedback, full contacts |
| C8 | Proposal & Funding Module | module1.html/js | Validated request form + live list |
| C9 | FYP Archive Module | module2.html/js | Search, filter, details |

## 2–3. Dependency matrix (row depends on column)
|    | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|----|----|----|----|----|----|----|----|----|----|
| C1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| C2 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| C3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C5 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C6 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| C7 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| C8 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| C9 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| **Total** | 0 | 1 | 1 | **6** | 4 | 0 | 0 | 0 | 0 |

## 4. Failure scenarios
- **C2 Authentication fails** → direct: C5 · indirect: C6, C7, C8, C9 · sign-in/sign-up/reset stop; already signed-in users continue (degraded). Found: blocked session storage caused a silent login → login loop.
- **C4 Shared UI Core (main.js) fails** (C5 is in the same file) → direct: C1, C2, C6, C7, C8, C9 · indirect: C5. Found: protected pages **failed open** — supervisor.html showed full contacts/CNIC with no login.

## 5. Critical component
**C4 Shared UI Core (main.js)** — 6 direct dependants, reaches 7 of 8 components, and shares a file with the access guard (single point of failure).

## 6. Failure-handling strategy (implemented)
- **Fail closed:** protected pages start as `<body class="fyp-guarded">`; content shows only after `FYP.requireRole()` passes.
- **Safe error message:** `FYP-CORE-UNAVAILABLE` screen (immediate on script error; CSS-only after 4 s even with JS disabled).
- **Unaffected functions continue:** landing page + status page.
- **Monitoring & alerting:** `status.html` health-checks C1–C9 and shows the cascading impact of any failure.
- **Scenario 1:** login verifies the session store before redirecting and shows `FYP-SESSION-STORE` instead of looping.
- Demo hooks: `dashboard.html?fault=core`, `supervisor.html?fault=core`, `login.html?fault=storage`.

## 7. Dependency graph
`screenshots/dependency-graph.png` (also interactive on `status.html`).

## Testing
36/36 automated checks passed (failure scenarios, Activity 1–3 regression, status page, mobile).

## Reflection
Dependency mapping showed that FYPilot's reliability and security both rest on main.js. Breaking it revealed that a failing security dependency can expose data rather than just stop a page, so the guard was redesigned to fail closed and monitoring was added. Later phases will split core services and enforce access on the backend.
