# SmartSeason Field Monitoring System

A simple web application for tracking crop progress across multiple fields during a growing season.

## Table of Contents

- [Demo Credentials](#demo-credentials)
- [Tech Stack](#tech-stack)
- [Local Setup](#local-setup)
- [Deployment Guide](#deployment-guide)
- [Design Decisions](#design-decisions)
- [Field Status Logic](#field-status-logic)
- [Assumptions](#assumptions)
- [What I Would Improve](#what-i-would-improve)



## Demo Credentials

Admin - admin@smartseason.com - admin123
field agent - agent@smartseason.com - agent123


## Tech Stack

 Layer      Technology                        

 Backend    Django 5 + Django REST Framework  
 Auth       Simple JWT                        
 Database   PostgreSQL                        
 Frontend   React + Vite                      
 HTTP       Axios                             
 Routing    React Router v6                   
 Styling    Plain CSS                         


## Local Setup

### Prerequisites

Make sure you have these installed:

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Git


### 1. Clone the Repository

```bash
git clone https://github.com/imbukwa1/smartseason.git
cd smartseason
```


### 2. Backend Setup

```bash
cd backend
```

**Create and activate a virtual environment:**

```bash
python -m venv venv

# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

**Create a `.env` file in the `backend/` folder:**

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=smartseason
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**Create the PostgreSQL database:**

```bash
psql -U postgres -c "CREATE DATABASE smartseason;"
```

**Run migrations:**

```bash
python manage.py migrate
```

**Seed demo users:**

```bash
python manage.py seed_demo_users
```

**Start the backend server:**

```bash
python manage.py runserver
```

Backend runs at: `http://localhost:8000`



### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
```

**Install dependencies:**

```bash
npm install
```

**Create a `.env` file in the `frontend/` folder:**

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

**Start the frontend dev server:**

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

### 4. Verify Everything Works

- Open `http://localhost:5173`
- Log in with the demo credentials above
- Admin sees all fields; Agent sees only assigned fields


## Deployment Guide

This guide deploys the backend to **Railway** (free tier) and the frontend to **Vercel** (free tier). Both are beginner-friendly and require no server management.


### Deploy the Backend (Railway)

**Railway** hosts Django + PostgreSQL for free and is the easiest option.

#### Step 1 — Create a Railway account

Go to [railway.app](https://railway.app) and sign up with GitHub.

#### Step 2 — Create a new project

- Click **New Project**
- Choose **Deploy from GitHub repo**
- Select your repository
- Choose the `backend/` folder as the root (Railway auto-detects Django)

#### Step 3 — Add a PostgreSQL database

- In your Railway project, click **+ New**
- Select **Database → PostgreSQL**
- Railway will automatically create and link the database

#### Step 4 — Set environment variables

In Railway → your Django service → **Variables**, add:

```
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=your-railway-domain.up.railway.app
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
DATABASE_URL=  ← Railway fills this automatically from the linked PostgreSQL
```

#### Step 5 — Add a Procfile

In your `backend/` folder, create a file called `Procfile` (no extension):

```
web: gunicorn smartseason.wsgi --bind 0.0.0.0:$PORT
release: python manage.py migrate
```

Add `gunicorn` to your requirements:

```bash
pip install gunicorn
pip freeze > requirements.txt
```

Commit and push — Railway will redeploy automatically.

#### Step 6 — Seed demo users on Railway

In Railway → your service → **Shell**:

```bash
python manage.py seed_demo_users
```

Your backend is now live at: `https://your-app.up.railway.app`


### Deploy the Frontend (Vercel)

#### Step 1 — Create a Vercel account

Go to [vercel.com](https://vercel.com) and sign up with GitHub.

#### Step 2 — Import your repository

- Click **Add New → Project**
- Select your GitHub repository
- Set the **Root Directory** to `frontend/`
- Framework preset: **Vite**

#### Step 3 — Set environment variables

In Vercel → your project → **Settings → Environment Variables**:

```
VITE_API_BASE_URL=https://your-railway-app.up.railway.app/api
```

#### Step 4 — Deploy

Click **Deploy**. Vercel builds and deploys automatically.

Your frontend is now live at: `https://your-app.vercel.app`


### After Deployment Checklist

- [ ] Backend health check works: `GET https://your-railway-app.up.railway.app/api/health/`
- [ ] Login works with demo credentials on the live URL
- [ ] Admin dashboard loads all fields
- [ ] Agent dashboard shows only assigned fields
- [ ] Field updates save correctly


## Design Decisions

### Role-Based Access

Two roles — `admin` and `agent` — are stored directly on the User model as a `role` CharField. This is intentional: Django Groups would add complexity without benefit for a two-role system this size.

All permission checks happen server-side in the API views. The frontend respects roles for routing, but the backend is the source of truth.

### JWT Authentication

Simple JWT was chosen over session-based auth because the frontend and backend are decoupled (separate origins). Tokens are stored in `localStorage` for simplicity — in production, `httpOnly` cookies would be more secure.

### API Filtering by Role

Rather than separate endpoints for admin and agent, the same endpoints apply server-side filters based on the authenticated user's role. This keeps the API surface small and consistent.

### No Heavy Frontend Libraries

The UI uses plain CSS only. The requirements explicitly state "simple, intuitive UI" — a component library would add build complexity without improving the core functionality being evaluated.

### Monorepo Structure

Frontend and backend live in the same repository for easier review and deployment coordination. They are independently deployable.


## Field Status Logic

Each field has a computed `status` property based on its current data:

| Status      | Condition                                                        |
|-------------|------------------------------------------------------------------|
| `completed` | Stage is `harvested`                                            |
| `at_risk`   | Stage is `planted` AND planting date was more than 30 days ago  |
| `active`    | Everything else                                                  |

**Rationale:** A field that was planted over 30 days ago but hasn't progressed past `planted` is likely delayed or neglected — flagging it as `at_risk` gives the admin early visibility. The 30-day threshold is a reasonable general assumption; in a real system, this would be crop-type-specific and configurable.


## Assumptions

- One agent can be assigned to multiple fields; one field has one assigned agent at a time.
- Field agents cannot create or delete fields — only admins manage the field registry.
- The "At Risk" threshold (30 days in `planted` stage) is a fixed business rule for this version.
- Email is used as the login identifier for clarity, though Django's default `username` field is kept.
- No email verification or password reset is implemented.


## What I Would Improve

With more time, I would:

1. **Configurable risk thresholds** — let admins set the "at risk" day threshold per crop type
2. **Photo uploads on field updates** — agents could attach images from the field
3. **Notifications** — alert admins when a field becomes "at risk"
4. **Pagination** — for farms with hundreds of fields, the current list views would need it
5. **httpOnly cookie auth** — more secure than localStorage for JWT tokens
6. **Test coverage** — unit tests for status logic and API permission checks at minimum
