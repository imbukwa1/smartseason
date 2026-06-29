# SmartSeason AI Crop Recommendation - Existing Architecture Review

## Purpose

This document reviews the current SmartSeason architecture before the crop recommendation module is designed or implemented. The goal is to fit future recommendation work into the existing Django and React structure without changing working field management or authentication behavior.

## Current Backend Architecture

SmartSeason uses a Django backend with Django REST Framework. The backend is organized around a single app, `core`, which currently owns users, field tracking, serializers, permissions, dashboard aggregation, and API views.

Key files:

- `backend/smartseason/settings.py`: project settings, installed apps, database configuration, CORS, JWT auth defaults, and `AUTH_USER_MODEL`.
- `backend/smartseason/urls.py`: central API routing for auth, dashboard, agents, and field routes.
- `backend/core/models.py`: database models for users, fields, and field updates.
- `backend/core/serializers.py`: request/response validation for auth, fields, field updates, and agents.
- `backend/core/views.py`: function views for auth/dashboard/agents and a `ModelViewSet` for fields.
- `backend/core/permissions.py`: role-based permission helper for admin-only actions.
- `backend/core/dashboard.py`: dashboard summary aggregation logic.
- `backend/core/admin.py`: Django Admin registration for the current models.

The project currently favors straightforward DRF serializers and views over a layered service architecture. The future recommendation module should preserve that simplicity, but recommendation scoring should still be isolated in a small service module because it will grow beyond basic CRUD.

## Current Frontend Architecture

SmartSeason uses React with Vite and plain CSS. Routing is handled in `frontend/src/App.jsx`, API calls use a shared Axios client, and authentication state is stored in `frontend/src/context/AuthContext.jsx`.

Key files:

- `frontend/src/App.jsx`: route definitions for login, registration, admin dashboard, and agent field views.
- `frontend/src/context/AuthContext.jsx`: login, registration, logout, token storage, and authenticated user loading.
- `frontend/src/api/axios.js`: shared Axios instance, API base URL, JWT request header injection, and refresh-token retry logic.
- `frontend/src/components/ProtectedRoute.jsx`: authenticated route guard.
- `frontend/src/pages/Dashboard.jsx`: admin workflow for field creation, editing, assignment, summaries, and update history.
- `frontend/src/pages/MyFields.jsx`: field-agent workflow for viewing assigned fields and posting field updates.
- `frontend/src/styles.css`: global app styling.

The frontend has no global state manager beyond auth context. Recommendation UI should follow this pattern: page-level state, local forms, shared `api` client, and protected routes.

## Existing Database Models

### User

`core.User` extends Django `AbstractUser`.

Important fields:

- `username`: retained from Django and currently aligned with email for registered users.
- `email`: unique login identifier.
- `role`: `admin` or `agent`, defaulting to `agent`.

Users are visible in Django Admin through `CustomUserAdmin`.

### Field

Represents a tracked farm field.

Important fields:

- `name`
- `crop_type`
- `planting_date`
- `stage`: `planted`, `growing`, `ready`, or `harvested`
- `assigned_agent`: optional foreign key to an agent user
- `created_at`
- `updated_at`

Important behavior:

- The computed `status` property returns `completed`, `at_risk`, or `active`.
- Agents can only be assigned when their `role` is `agent`.

### FieldUpdate

Represents updates submitted by agents.

Important fields:

- `field`
- `agent`
- `new_stage`
- `notes`
- `created_at`

Important behavior:

- Posting an update also updates the parent field stage.
- Agents can only post updates for fields assigned to them.

## Existing API Structure

Current top-level API routes:

- `POST /api/auth/register/`: self-register a Field Agent and receive JWT tokens.
- `POST /api/auth/login/`: authenticate by email and password, receive JWT tokens.
- `POST /api/auth/refresh/`: refresh an access token.
- `GET /api/auth/me/`: return the authenticated user.
- `GET /api/dashboard/`: return role-filtered dashboard summary data.
- `GET /api/agents/`: admin-only list of field agents.
- `/api/fields/`: DRF router routes for field list/create/detail/update/delete.
- `GET /api/fields/{id}/updates/`: list field updates.
- `POST /api/fields/{id}/updates/`: agent-only field update submission.

The backend uses JWT auth globally through DRF settings. Public endpoints explicitly use `AllowAny`; protected endpoints use `IsAuthenticated` or `IsAdmin`.

## Authentication Flow

Registration:

1. The React registration page posts user details to `/api/auth/register/`.
2. The backend validates required names, email uniqueness, password requirements, and password confirmation.
3. The backend creates a user with a hashed password and default `agent` role.
4. The backend returns access and refresh tokens.
5. The frontend stores tokens and user data in `localStorage`.
6. Agents are routed to `/my-fields`; admins are routed to `/dashboard`.

Login:

1. The React login page posts email and password to `/api/auth/login/`.
2. The backend finds users by email, checks active status, and verifies the hashed password.
3. JWT tokens are returned.
4. The frontend loads `/api/auth/me/` and routes users by role.

Token refresh:

1. The Axios interceptor attaches the access token to requests.
2. On a `401`, the interceptor attempts `/auth/refresh/` with the stored refresh token.
3. If refresh fails, local auth storage is cleared.

## Field Management Workflow

Admin workflow:

1. Admin logs in and lands on `/dashboard`.
2. Dashboard loads `/dashboard/`, `/fields/`, and `/agents/`.
3. Admin can create fields, assign agents, update field details, and inspect update history.
4. Server-side permissions enforce admin-only create/update/delete for fields.

Agent workflow:

1. Agent logs in and lands on `/my-fields`.
2. Agent sees only fields assigned to them.
3. Agent opens field details and submits stage updates with notes.
4. Server-side validation prevents agents from updating unassigned fields.

## How Crop Recommendations Should Fit

The recommendation module should be added as a new feature area while reusing existing conventions:

- Backend models should live in `core.models` initially unless the module grows enough to justify a separate Django app.
- Recommendation serializers should live in `core.serializers` or, if the file becomes large, move into a `core/serializers/` package in a later refactor.
- Recommendation API views can start as function views or a small DRF viewset, matching the current style.
- Scoring logic should be isolated in a new `core/recommendations.py` or `core/services/recommendations.py` module so API views stay thin.
- Admin-only catalog management, such as crop and soil type setup, should follow the existing `IsAdmin` permission pattern.
- Recommendation generation should require authentication. Both admins and agents can request recommendations, but returned data should be scoped to the authenticated user and any field ownership rules.
- Frontend pages should use the shared `api` client, page-level state, and existing protected routes.

## Design Constraints For Future Work

- Do not replace the current field workflow; recommendations should assist planning, not overwrite field records.
- Keep the first implementation deterministic and explainable before adding ML.
- Store inputs and outputs so users can review recommendation history.
- Keep weather integration behind a service interface so the API can be added later without changing frontend request contracts.
- Avoid introducing background workers, vector databases, or ML infrastructure until the rule-based recommendation flow proves useful.

