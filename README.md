# Intern Hub Workspace (Dailoqa) — V2 MVP Baseline

Intern Hub is an enterprise workspace platform featuring unified role-based portals for Super Admins, Managers, Tech Leads, and Interns. This repository contains the production-ready **V2 MVP baseline** with Project Management, Work Management, Personal Tasks, User Provisioning, Forms Management, and Background Notifications.

---

## 🏗️ Architecture Overview

The system is organized into a clean, modern decoupled architecture:

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, unified authentication context, dynamic role-based routing.
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM, Argon2 password hashing, JWT access/refresh tokens.
- **Database**: PostgreSQL 16 (persisting organizations, users, roles, sessions, projects, work items, forms, submissions, and notification recipients).
- **Asynchronous Queue Broker**: Redis 7.
- **Background Worker**: Dedicated Node.js worker process utilizing BullMQ to process and deliver broadcast notifications asynchronously without blocking API request threads.
- **Multi-Tenancy**: Organization-level isolation enforced across all database queries and routes. Super Admin operates as a global platform role (`organization_id = null`).

---

## ⚡ Quick Start (Docker Stack)

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Git

### 2. Setup & Launch
```bash
# 1. Clone & enter repository
git clone <repo-url>
cd project-management-dashboard-m

# 2. Checkout stable v2 branch
git checkout v2

# 3. Create environment configuration
cp .env.example .env    # On Windows PowerShell: Copy-Item .env.example .env

# 4. Start Docker stack (PostgreSQL, Redis, Backend API, Notification Worker)
docker compose up -d --build

# 5. Apply Prisma database migrations & seed baseline data
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# 6. Start Frontend Development Server
cd frontend
npm install
npm run dev
```

The frontend will be available at **`http://localhost:3000`** (or `http://localhost:5173`).  
The backend API is exposed at **`http://localhost:3001/api`**.

---

## 🔑 Default Seed Credentials

| Role | Email | Password | Scope / Portal |
|---|---|---|---|
| **Super Admin** | `superadmin@platform.local` | `SuperAdmin@123` | Global (`/super-admin`) |
| **Manager** | `manager@dailoqa.com` | `password123` | Dailoqa Technologies (`/manager`) |
| **Tech Lead** | `lead@dailoqa.com` | `password123` | Dailoqa Technologies (`/manager`) |
| **Intern** | `intern@dailoqa.com` | `password123` | Dailoqa Technologies (`/intern`) |

---

## 📦 Core Modules Implemented (V2 MVP Baseline)

### 1. Authentication & Multi-Tenant RBAC
- Stateless 15-minute access JWTs + rotating 7-day refresh tokens backed by `user_sessions` in PostgreSQL.
- Argon2 password hashing.
- Super Admin platform management with global organization creation and initial manager provisioning.
- Organization isolation: all queries scoped strictly to the authenticated user's `organization_id`.

### 2. User & Intern Provisioning
- Individual user creation with auto-generated secure credentials.
- Bulk CSV user import with pre-validation, duplicate email checks, and atomic batch insertion.
- Temporary passwords with forced password change flags (`must_change_password`).
- Manager user management: password reset and account deactivation.

### 3. Project Management V1
- Full project lifecycle: `PLANNED`, `ACTIVE`, `COMPLETED`, `ARCHIVED`.
- Project team membership management with tenant boundary enforcement.
- Project specifications and documentation upload (`storage/projects/:id`), secure download, and preview.
- Scoped project workspace views for both Managers and Interns.

### 4. Work Management V1
- Strict hierarchy enforcement: `PROJECT` ➔ `EPIC` ➔ `STORY` ➔ `TASK` ➔ `SUBTASK`.
- Standalone `BUG` work items.
- Hierarchy validation rejecting invalid or cross-project parent relationships.
- Safe deletion preventing deletion of work items with active children.

### 5. Personal Tasks System
- User-scoped personal tasks with `project_id = null`.
- Automatic assignment to creator.
- Private filtering (`GET /api/work-items?my_personal=true`) preventing cross-user visibility.
- 1-click status completion toggling.

### 6. Forms & FOM (Forms Operations Management)
- Manager Form Builder with dynamic question types (`SHORT_TEXT`, `LONG_TEXT`, `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `RATING_1_5`, `URL`).
- Form publishing and assignment to organization interns.
- Intern dynamic form completion modal and submission answer persistence in PostgreSQL.

### 7. Background Notifications (BullMQ + Redis)
- Manager broadcast alerts dispatched to all cohort interns or targeted individuals.
- Asynchronous BullMQ background worker (`notification-queue`) ensuring immediate API responses.
- Per-recipient delivery tracking, inbox listing, and independent read/unread states.
- High-visibility banner and dedicated Alerts view in the Intern portal.

---

## 🔮 Deferred Functionality (Planned for V2)

The following modules are planned for future iterations and have standard non-mock informational placeholders:
- **Invoice Management**: Financial invoicing and billing workflows.
- **Minutes of Meeting (MoM)**: Meeting notes and action-item tracking.
- **Attendance & Timesheets**: Daily automated session check-ins and attendance exports.

---

## 🧪 Verification & Test Suites

Run the automated integration test suites inside the backend container:

```bash
# 1. Project Management & Work Management V1 Suite (33 checks)
docker compose exec backend npx tsx scripts/verify-pm-v1.ts

# 2. BullMQ + Redis Background Notifications Suite (24 checks)
docker compose exec backend npx tsx scripts/verify-notifications.ts

# 3. Pre-Push Integration Hardening Suite (21 checks)
docker compose exec backend npx tsx scripts/verify-hardening.ts
```

Frontend production build check:
```bash
cd frontend && npm run build
```
