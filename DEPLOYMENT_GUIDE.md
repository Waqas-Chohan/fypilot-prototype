# FYPilot deployment guide (free): Vercel + Render + Neon

```
Browser ──► Vercel (static frontend, https://fypilot.vercel.app)
               │  fetch() with JWT
               ▼
            Render (Flask backend, gunicorn)  ──►  Neon (PostgreSQL)
```

## A. What was changed in the code, and why

| File | Change | Why |
| --- | --- | --- |
| `backend/requirements.txt` | added `gunicorn` | Flask's built-in server is for development only. Render needs a production WSGI server to run `gunicorn app:app`. |
| `backend/app.py` | `bootstrap()` runs `init_db()` at import time | Before, tables were created only under `python app.py`. Gunicorn imports the module instead, so without this the Neon database would stay empty. If the DB is down at boot the error is logged and the server still starts, so `/api/health` stays reachable. |
| `backend/app.py` | CORS origins come from `FRONTEND_ORIGINS` (default: localhost + `https://fypilot.vercel.app`) | The browser blocks calls from your Vercel site unless the backend explicitly allows that origin. Any other origin is still refused. |
| `backend/app.py` | `SEED_DEMO_USERS=false` skips demo accounts | The demo accounts share the password `12345678`. Turn them off for a real public deployment. |
| `backend/app.py` | `connect_timeout=10`, port read from `PORT` | Avoids hanging forever on a sleeping database; PORT is how platforms tell the app where to listen. |
| `assets/js/config.js` (new) | single place that sets `API_BASE`: localhost when you open the site locally, the Render URL when deployed | The backend URL was hard-coded as `localhost:5000` in three places. |
| `main.js`, `login.js` | use `API_BASE` from config | Removes the hard-coded URLs. |
| all `*.html` | load `config.js` before `main.js` | `main.js` reads the config when it starts. |
| `render.yaml` (new) | optional Render Blueprint | Lets Render create the service from the repo with the right commands. |

Nothing secret was added to the repo. Secrets live only in Render's dashboard.

## B. Step-by-step

### 1. Neon (database)
1. Go to <https://neon.tech> and sign up (GitHub login works).
2. Create a project named `fypilot` (pick the region closest to you).
3. On the dashboard click **Connect** and copy the **connection string**. It looks like
   `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
   Keep `?sslmode=require`: Neon only accepts encrypted connections.
4. Nothing else is needed. The backend creates the tables itself on first start.
   (Optional: paste `backend/schema.sql` into Neon's **SQL Editor** and run it.)

### 2. Render (backend)
1. Go to <https://render.com> and sign up with GitHub.
2. **New + → Web Service** → connect `Waqas-Chohan/fypilot-prototype`.
3. Fill in:
   - **Name:** `fypilot-backend`. The URL becomes `https://fypilot-backend.onrender.com`. If that name is taken, Render gives you a different URL. Use that URL in step 3 below.
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --workers 1 --threads 4 --timeout 60`
   - **Instance type:** Free
4. Open **Environment** and add:
   - `DATABASE_URL` = the Neon connection string
   - `JWT_SECRET_KEY` = a long random string (e.g. run `python -c "import secrets;print(secrets.token_urlsafe(48))"`)
   - `FRONTEND_ORIGINS` = `https://fypilot.vercel.app` (add more origins separated by commas)
   - `SEED_DEMO_USERS` = `true` for your demo (set `false` afterwards if you want no shared-password accounts)
5. Click **Create Web Service** and wait for "Live".
6. Open `https://<your-service>.onrender.com/api/health`. You should see `{"status":"ok", ...}`.

Alternative: **New + → Blueprint** reads `render.yaml` and fills in the same settings. You still paste `DATABASE_URL` yourself.

### 3. Point the frontend at Render
1. Open `assets/js/config.js`.
2. If your Render URL is not `https://fypilot-backend.onrender.com`, change the deployed branch to your URL, keeping `/api` at the end.
3. Commit and push to `main`. Vercel redeploys automatically.

### 4. Test
1. Open <https://fypilot.vercel.app/login.html> and sign in as `w.saqib@student.nu.edu.pk` / `12345678` (student) or `tahir@faculty.nu.edu.pk` / `12345678` (supervisor).
2. Submit a funding request in Module 1 and check Module 2 loads the archive.
3. In the Neon **Tables** view you should see the new rows.

## C. Things to know
- **Free tier sleep:** Render's free web service sleeps after about 15 minutes idle and takes about a minute to wake. Open the site a minute before a demo.
- **Wrong URL / CORS errors:** open the browser DevTools **Network** tab. A failed call to the wrong host means `config.js` is wrong. A "CORS" message means `FRONTEND_ORIGINS` is missing your exact Vercel URL (no trailing slash).
- **Logs:** Render → your service → **Logs** shows the "Database initialized" line and any errors.
- **Local development still works:** open the site on `localhost:8080` and run `python app.py`; `config.js` picks the local backend automatically.
- **Security:** keep `.env` out of git; rotate `JWT_SECRET_KEY` if it ever leaks; change or disable the demo accounts before sharing the link publicly.
