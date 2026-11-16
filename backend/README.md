# FYPilot backend (Activity 6)
Flask + PostgreSQL + JWT.

    cd backend
    pip install -r requirements.txt
    # create DB:  psql -U postgres -c "CREATE DATABASE fypilot"
    cp .env.example .env     # then edit values
    python app.py            # http://127.0.0.1:5000 (creates tables, seeds demo users)
    python tests/test_api.py # API checks (backend must be running)

Frontend: from the project root run `python -m http.server 8080` and open http://localhost:8080/login.html.
Demo users (password 12345678): w.saqib@student.nu.edu.pk (student), tahir@faculty.nu.edu.pk (supervisor).
