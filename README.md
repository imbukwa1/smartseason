# SmartSeason

Monorepo with a Django REST backend and a Vite React frontend.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver
```

Health check:

```text
GET http://localhost:8000/api/health/
```

## Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

App:

```text
http://localhost:5173
```
