# Cloud Deployment & CI/CD – Hospital Management Platform

A production-style Doctor Appointment API and cloud operations platform engineered with **Node.js 22**, **Express**, **MongoDB 7**, and **Nginx**. This repository serves as a complete MVP and reference implementation demonstrating core DevOps and cloud engineering disciplines: multi-stage containerization, zero-trust network isolation, database-level race condition prevention, automated CI/CD with security gating, disaster recovery, and chaos/resilience engineering.

---

## Submission Evidence

- **Pipeline Run:** [https://github.com/vishi122/hospital-management-platform/actions/runs/43736904732](https://github.com/vishi122/hospital-management-platform/actions/runs/43736904732)
- **Container Image:** `ghcr.io/vishi122/hospital-management-platform:v1.0.0`
- **Image Digest:** `sha256:b8f2089851d1d2ed20557747e17d8d6cf3f0dabc7c2139ad9224a0807d8626e4`
- **Demo Video:** `<add after recording>`
- **Demo Type:** local-only (no live URL)

---

## Table of Contents

1. [Executive Summary: What Was Built](#1-executive-summary-what-was-built)
2. [Architecture & Network Topology](#2-architecture--network-topology)
3. [Repository Structure](#3-repository-structure)
4. [Detailed Breakdown of Implementation](#4-detailed-breakdown-of-implementation)
   - [Service Layer & Business Logic](#41-service-layer--business-logic)
   - [Concurrency & Race Condition Engine](#42-concurrency--race-condition-engine)
   - [Audit Logging & Observability](#43-audit-logging--observability)
   - [Containerization & Network Isolation](#44-containerization--network-isolation)
   - [Database Least Privilege & Auth](#45-database-least-privilege--auth)
   - [CI/CD Pipeline (GitHub Actions)](#46-cicd-pipeline-github-actions)
   - [Operations & Disaster Recovery Suite](#47-operations--disaster-recovery-suite)
5. [Prerequisites & Port Map](#5-prerequisites--port-map)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Clean-Environment Setup & Run Steps](#7-clean-environment-setup--run-steps)
8. [API Verification Guide (curl Examples)](#8-api-verification-guide-curl-examples)
9. [Operational Runbooks & Command Reference](#9-operational-runbooks--command-reference)
10. [CI/CD & GitHub Push Instructions](#10-cicd--github-push-instructions)
11. [Empirical Evidence & Acceptance Checklist](#11-empirical-evidence--acceptance-checklist)
12. [Known Limitations & Production Roadmap](#12-known-limitations--production-roadmap)

---

## 1. Executive Summary: What Was Built

Every component of this repository was designed from first principles to reflect production cloud engineering standards:

- **100% Synthetic Data & Zero Secret Leakage:** No real patient or doctor information is stored. No passwords, certificates, or `.env` files are tracked in git (enforced via `.gitignore` and `.dockerignore`).
- **Strict Network Isolation:** Express (`3000`) and MongoDB (`27017`) do not publish host ports. Traffic is strictly brokered through Nginx on port `443` (TLS 1.2/1.3) with HTTP `80` automatically redirecting to `443`.
- **Database-Level Concurrency Locking:** Double-booking prevention is enforced by MongoDB itself via a partial unique compound index `{ doctorId: 1, slotTime: 1 }` with `partialFilterExpression: { status: "confirmed" }`. Concurrent booking collisions catch duplicate-key code `11000` and return `HTTP 409 Conflict`.
- **Comprehensive Observability:** Every request receives an `X-Request-Id` correlation header; structured JSON logging is handled by Pino; and Prometheus metrics are exposed at `/metrics`.
- **Resilience & Chaos Tested:** Includes automated scripts for database disaster recovery (100% parity verified after drop) and outage simulations showing dynamic `/ready` 503 degradation and 200 self-healing.
- **Enterprise CI/CD:** Complete GitHub Actions pipeline executing ESLint, Prettier, MongoDB service container tests, `npm audit --audit-level=high`, Aqua Trivy container scanning, Buildx cache, and GHCR multi-tag publication with cryptographic digests.

---

## 2. Architecture & Network Topology

### Ingress & Data Flow

```
                              +---------------------------------------+
                              |       Public Internet / Client        |
                              +---------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              |       Nginx Reverse Proxy & TLS       |
                              |  Port 80 (Redirect 301) | Port 443    |
                              +---------------------------------------+
                                                  |
                                                  | (hospital_network: Bridge)
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
        +----------------------------------+             +----------------------------------+
        | Express Doctor Appointment API   |             | MongoDB 7.0 Persistence Store    |
        | Image: node:22.14.0-alpine       |             | Image: mongo:7.0.15              |
        | User: node (UID 1000, Non-Root)  | <=========> | Auth: Root + App Least-Privilege |
        | Port: 3000 (Internal Only)       |             | Port: 27017 (Internal Only)      |
        +----------------------------------+             +----------------------------------+
                                                                           |
                                                         +----------------------------------+
                                                         | Named Volume: hospital_mongo_data|
                                                         +----------------------------------+
```

### CI/CD Deployment Flow

```
[ Git Push / PR ] ──> [ GitHub Actions: ci.yml ]
                            ├── 1. Lint & Format (eslint, prettier)
                            ├── 2. Integration Tests (MongoDB Service Container)
                            ├── 3. Dependency Audit (npm audit --audit-level=high)
                            ├── 4. Container Vulnerability Scan (Aqua Trivy)
                            └── 5. Buildx Build & Push ──> [ GitHub Container Registry (ghcr.io) ]
                                                                       │
                                                                       v
                                                           [ scripts/deploy.sh ]
                                                           └── docker compose pull && up -d
                                                           └── Polling https://localhost/ready
```

---

## 3. Repository Structure

```text
.
├── .dockerignore                           # Excludes node_modules, certs, .env, backups from Docker build
├── .env.example                            # Configuration template with placeholder values only
├── .gitattributes                          # Normalizes LF endings for scripts and Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions CI/CD pipeline (lint, test, audit, trivy, ghcr)
├── .gitignore                              # Strict exclusion of .env, certs, keys, and backup archives
├── .prettierignore / .prettierrc           # Prettier configuration and ignore rules
├── Dockerfile                              # Multi-stage build (node:22.14.0-alpine, non-root user node)
├── README.md                               # Master technical documentation & verification guide
├── backups/
│   └── .gitkeep                            # Backup directory (archives ignored by git)
├── docker-compose.yml                      # Orchestrates app, mongo, and nginx with internal network & healthchecks
├── docs/
│   ├── AI_USAGE.md                         # Declaration of AI tools used during architecture and development
│   ├── DEMO_SCRIPT.md                      # 3–5 minute step-by-step evaluator demo walkthrough
│   ├── RUNBOOK.md                          # Production operations runbook, incident response & troubleshooting
│   └── architecture.md                     # Deep architectural breakdown with Mermaid diagrams
├── eslint.config.js                        # ESLint flat configuration for Node.js 22
├── evidence/                               # Captured verification transcripts & evidence outputs
│   ├── backup-restore-transcript.txt       # Backup, collection wipe, restore, and 100% count parity proof
│   ├── concurrency-test-output.txt         # N=10 parallel booking test (1x 201, 9x 409 conflict)
│   ├── docker-compose-ps.txt               # Running container state & port isolation proof
│   ├── failure-recovery-transcript.txt     # Mongo & App outage simulation, 503 detection & recovery proof
│   ├── image-digest.txt                    # Docker image inspection, tags, and sha256 digest
│   └── test-output.txt                     # Full Jest test run output (31/31 passed)
├── jest.config.js                          # Jest testing suite configuration
├── mongo-init/
│   └── 01-init-mongo.js                    # Least-privilege application database user provisioning
├── nginx/
│   ├── certs/
│   │   └── .gitkeep                        # TLS certificate storage (keys & certs ignored by git)
│   └── nginx.conf                          # Reverse proxy, TLS 1.2/1.3 termination, HTTP->HTTPS redirect
├── package.json / package-lock.json        # Pinned dependencies & operational scripts
├── scripts/
│   ├── backup.sh / backup.ps1              # MongoDB compressed archive dump
│   ├── deploy.sh / deploy.ps1              # Deployment script with /ready health polling
│   ├── failure_drill.sh / failure_drill.ps1# Chaos resilience drill script
│   ├── gen-certs.sh / gen-certs.ps1        # Self-signed TLS certificate generator
│   ├── restore.sh / restore.ps1            # Drop-and-restore database recovery script
│   ├── rollback.sh / rollback.ps1          # Image rollback and verification script
│   └── seed.js                             # Synthetic data seeder (users, doctors, slots, appointments)
├── src/
│   ├── app.js                              # Express application setup, security middleware, and routes
│   ├── config.js                           # Environment variable validation and defaults
│   ├── db.js                               # Mongoose connection, readiness ping, and index verification
│   ├── logger.js                           # Pino structured logging & X-Request-Id correlation
│   ├── metrics.js                          # Prometheus prom-client metrics setup
│   ├── middleware/
│   │   ├── auth.js                         # JWT verification, RBAC, and patient isolation middleware
│   │   └── errorHandler.js                 # Global error handling (MongoDB 11000 -> 409, validation -> 400)
│   ├── models/
│   │   ├── Appointment.js                  # Appointment schema with partial unique index
│   │   ├── AuditEvent.js                   # Audit trail schema (who, role, action, entity, timestamp)
│   │   ├── Doctor.js                       # Doctor profile, specialization, and availability schedule
│   │   └── User.js                         # User schema with bcrypt password hashing
│   ├── routes/
│   │   ├── appointments.js                 # Booking, rescheduling, cancellation, and retrieval endpoints
│   │   ├── auth.js                         # Login, registration, and user context endpoints
│   │   ├── doctors.js                      # Doctor directory and dynamic 30-minute slot generator
│   │   └── health.js                       # /health (liveness), /ready (MongoDB ping), /metrics (Prometheus)
│   ├── server.js                           # Server bootstrap and graceful shutdown signal handlers
│   └── services/
│       ├── auditService.js                 # Helper to record audit events asynchronously
│       └── slotValidator.js                # Slot alignment (30 min), working hours (09:00–17:00), future time
└── tests/
    ├── appointments.test.js                # Appointment CRUD, validation, reschedule, and cancellation tests
    ├── auth.test.js                        # Authentication and RBAC authorization tests
    ├── concurrency.test.js                 # High-concurrency race condition booking tests (N=10)
    ├── doctors.test.js                     # Doctor availability and slot calculation tests
    ├── health.test.js                      # Liveness, readiness failure/recovery, and metrics tests
    └── setup.js                            # Global test environment configuration & hooks
```

---

## 4. Detailed Breakdown of Implementation

### 4.1 Service Layer & Business Logic

- **Framework:** Node.js 22 LTS with Express.
- **Liveness Probe (`GET /health`):** Returns HTTP 200 with service uptime, timestamp, and version as long as the Express process is active.
- **Readiness Probe (`GET /ready`):** Dynamically executes `mongoose.connection.db.admin().ping()`. If MongoDB is reachable, it returns HTTP 200 `{"status":"ready","database":"connected"}`; if MongoDB is unreachable or disconnected, it returns HTTP 503 Service Unavailable `{"status":"not ready","database":"disconnected"}`.
- **Role-Based Access Control (RBAC):**
  - Roles: `admin`, `doctor`, `patient`.
  - Passwords hashed using `bcrypt` (10 salt rounds).
  - Patient endpoints enforce strict ownership: patients can only query or alter their own appointments. Admins have system-wide visibility. Doctors can inspect their assigned appointments.
- **Doctor Availability Engine:**
  - Evaluates doctor schedules (default: 09:00–17:00 UTC).
  - Divides working windows into distinct 30-minute blocks.
  - Dynamically computes already confirmed appointments and returns only unbooked, available slots.

### 4.2 Concurrency & Race Condition Engine

To guarantee zero double-booking under high concurrent load across scaled application instances, locking is implemented at the database layer rather than relying on in-memory application mutexes:

1. **MongoDB Partial Unique Index:**
   ```javascript
   // src/models/Appointment.js
   appointmentSchema.index(
     { doctorId: 1, slotTime: 1 },
     {
       unique: true,
       partialFilterExpression: { status: 'confirmed' },
     }
   );
   ```
2. **Index Startup Assurance:** Before Express begins listening on port 3000, `src/db.js` calls `Appointment.syncIndexes()` and `Appointment.init()`, guaranteeing that unique constraints are active before accepting HTTP traffic.
3. **Collision Interception:**
   When two requests attempt to book the same doctor at the same slot concurrently, MongoDB allows the first write to succeed and rejects the second with duplicate-key error `E11000`. The global error handler catches `11000` and transforms it into:
   ```json
   HTTP/1.1 409 Conflict
   {
     "error": "Conflict",
     "code": "SLOT_ALREADY_BOOKED",
     "message": "The requested doctor already has a confirmed appointment at this slot time."
   }
   ```
4. **Reschedule Safety:** Rescheduling uses `findOneAndUpdate` with atomic condition updates, ensuring that slot changes also respect the unique index and return 409 if the destination slot is taken.

### 4.3 Audit Logging & Observability

- **Structured JSON Logging:** Built using `pino` and `pino-http`. Logs emit structured JSON containing request method, path, status, latency, user context, and errors.
- **Distributed Request Tracing:** Every incoming request receives an `X-Request-Id` (propagated from client or generated via `crypto.randomUUID()`), attached before headers flush, and included in every log line.
- **Audit Collection:** Key state changes are permanently logged to the `auditevents` collection:
  - `auth.login`: User login timestamps and roles.
  - `appointment.create`: Booking creation with patient and doctor IDs.
  - `appointment.reschedule`: Previous and new slot timestamps.
  - `appointment.cancel`: Cancellation event.
- **Prometheus Metrics (`GET /metrics`):** Emits standard Node.js runtime metrics (memory, event loop lag, GC) plus custom Prometheus metrics:
  - `http_requests_total` (counter by method, route, status code)
  - `http_request_duration_seconds` (histogram by route)
  - `hospital_appointments_total` (counter by status)

### 4.4 Containerization & Network Isolation

- **Base Image:** Pinned `node:22.14.0-alpine3.21` for minimal footprint and reduced CVE attack surface.
- **Multi-Stage Build:**
  - Stage 1 (`dependencies`): Installs all dependencies for compilation.
  - Stage 2 (`production-dependencies`): Runs `npm ci --omit=dev` to prune dev dependencies.
  - Stage 3 (`runtime`): Copies production dependencies, application source, configures non-root user `node:node` (UID 1000), adds `dumb-init` for signal handling, and establishes container `HEALTHCHECK`.
- **Zero Exposed Backend Ports:**
  ```yaml
  # docker-compose.yml
  app:
    expose:
      - '3000' # Internal only, no host port mapping
  mongo:
    expose:
      - '27017' # Internal only, no host port mapping
  nginx:
    ports:
      - '80:80' # Exposed to host
      - '443:443' # Exposed to host
  ```
- **Service Health & Dependency Ordering:** Uses Docker Compose `depends_on` with `condition: service_healthy` so `hospital_app` starts only after `hospital_mongo` is healthy, and `hospital_nginx` starts only after `hospital_app` is healthy.

### 4.5 Database Least Privilege & Auth

MongoDB is initialized with role-based authentication:

- **Administrative Account:** `rootadmin` with `root` privileges on the `admin` database (used solely for maintenance and initial provisioning).
- **Application Account:** `hospital_app` created via [mongo-init/01-init-mongo.js](mongo-init/01-init-mongo.js) with strictly scoped `readWrite` permissions on `hospital_db`:
  ```javascript
  db.createUser({
    user: 'hospital_app',
    pwd: '...',
    roles: [{ role: 'readWrite', db: 'hospital_db' }],
  });
  ```

### 4.6 CI/CD Pipeline (GitHub Actions)

Located in [.github/workflows/ci.yml](./.github/workflows/ci.yml):

1. **Trigger Matrix:** Runs on `push` to `main`, tags matching `v*`, and all pull requests to `main`.
2. **Lint & Formatting Job:** Executes `npm run lint` (`eslint`) and `npm run format:check` (`prettier --check`).
3. **Database Integration Tests:** Boots a live MongoDB 7 service container (`mongo:7.0.15`) with health checks, sets `MONGO_URI`, and runs the full Jest suite including the 10-client concurrency test.
4. **Security Vulnerability Gating:**
   - Runs `npm audit --audit-level=high`.
   - Runs Aqua Security Trivy container scanner against the built image, reporting CVE vulnerabilities.
5. **Docker Buildx & GHCR Publishing:**
   - Caches Docker build layers using GitHub Actions cache (`type=gha`).
   - Tags images with Git SHA (`sha-<short-sha>`), SemVer tag (e.g. `v1.0.0` if tagged), and run number (`run-<number>`).
   - Publishes to GitHub Container Registry (`ghcr.io/<owner>/<repo>`) only on `main` or `v*` tags.
   - Emits the immutable image SHA256 digest in `$GITHUB_STEP_SUMMARY` and workflow logs.
6. **Least Privilege Security:** Global workflow permissions are set to `contents: read`; `packages: write` is granted strictly to the container publish job.

### 4.7 Operations & Disaster Recovery Suite

- **Deployment Script (`scripts/deploy.sh`):** Automates pulling a target image tag, regenerating containers with zero downtime, and polling `https://localhost/ready` with a 60-second timeout until healthy.
- **Backup Script (`scripts/backup.sh`):** Executes `mongodump --archive --gzip` directly inside the container and exports a timestamped backup archive to `backups/hospital_db_backup_<YYYYMMDD_HHMMSS>.gz`.
- **Restore Script (`scripts/restore.sh`):** Executes `mongorestore --drop --archive=<FILE> --gzip`, dropping stale data and restoring database collections to full parity.
- **Rollback Script (`scripts/rollback.sh`):** Instantly rolls back to a designated previous image tag and validates system readiness.
- **Failure Resilience Drill (`scripts/failure_drill.sh`):** Simulates database disruption (stops Mongo, verifies `/ready` returns 503, captures logs, restarts Mongo, and verifies `/ready` recovers to 200) followed by application crash and recovery verification.

---

## 5. Prerequisites & Port Map

### System Requirements

- [Docker Engine](https://docs.docker.com/get-docker/) (v24+ recommended) & [Docker Compose](https://docs.docker.com/compose/) (v2+ recommended)
- [Git](https://git-scm.com/)
- [OpenSSL](https://www.openssl.org/) (for TLS certificates)
- [curl](https://curl.se/)

### Port Map

| Component         | Container Name   | Host Port | Internal Port | Protocol    | Public Access     | Purpose                         |
| :---------------- | :--------------- | :-------- | :------------ | :---------- | :---------------- | :------------------------------ |
| **Nginx (HTTP)**  | `hospital_nginx` | `80`      | `80`          | TCP / HTTP  | **Yes**           | 301 Redirect to HTTPS           |
| **Nginx (HTTPS)** | `hospital_nginx` | `443`     | `443`         | TCP / TLS   | **Yes**           | TLS Termination & Reverse Proxy |
| **Express API**   | `hospital_app`   | _None_    | `3000`        | TCP / HTTP  | **No** (Internal) | Core Application API            |
| **MongoDB**       | `hospital_mongo` | _None_    | `27017`       | TCP / Mongo | **No** (Internal) | Database Engine                 |

---

## 6. Environment Variables Reference

Configuration is managed strictly through environment variables. Use [.env.example](./.env.example) as the template:

| Variable              | Default Value        | Required? | Description                                                   |
| :-------------------- | :------------------- | :-------- | :------------------------------------------------------------ |
| `NODE_ENV`            | `production`         | No        | Application environment (`production`, `development`, `test`) |
| `PORT`                | `3000`               | No        | Internal port for Express                                     |
| `MONGO_ROOT_USERNAME` | `rootadmin`          | Yes       | MongoDB administrative username                               |
| `MONGO_ROOT_PASSWORD` | _(Set in .env)_      | Yes       | MongoDB administrative password                               |
| `MONGO_APP_USERNAME`  | `hospital_app`       | Yes       | Application least-privilege username                          |
| `MONGO_APP_PASSWORD`  | _(Set in .env)_      | Yes       | Application least-privilege password                          |
| `MONGO_DATABASE`      | `hospital_db`        | Yes       | Target database name                                          |
| `MONGO_URI`           | _(Computed)_         | Yes       | Mongoose connection URI                                       |
| `JWT_SECRET`          | _(Random 32+ chars)_ | Yes       | Symmetric secret key for signing JWTs                         |
| `JWT_EXPIRES_IN`      | `24h`                | No        | Token expiration duration                                     |
| `LOG_LEVEL`           | `info`               | No        | Pino logging level (`debug`, `info`, `warn`, `error`)         |
| `ENABLE_METRICS`      | `true`               | No        | Enable Prometheus exposition on `/metrics`                    |

---

## 7. Clean-Environment Setup & Run Steps

Follow these exact steps from a freshly cloned workspace:

### Step 1: Create Environment File

```bash
# Copy template to .env (do not commit .env)
cp .env.example .env
```

_(On Windows PowerShell: `Copy-Item .env.example .env`)_

### Step 2: Generate Self-Signed TLS Certificates

```bash
# On Linux / macOS / Git Bash:
chmod +x scripts/*.sh
./scripts/gen-certs.sh

# On Windows PowerShell:
.\scripts\gen-certs.ps1
```

This generates `nginx/certs/server.key` and `nginx/certs/server.crt` with Subject Alternative Names for `localhost`.

### Step 3: Build & Launch Containers

```bash
# Build multi-stage image and start stack in background
docker compose up -d --build

# Verify all 3 containers are healthy
docker compose ps
```

### Step 4: Seed Synthetic Test Data

```bash
# Seed fake doctors, patients, and initial slots
docker compose exec app node scripts/seed.js
```

Seeded test accounts available:

- **Admin:** `admin@hospital.local` / `AdminPassword123!`
- **Doctor:** `doctor.smith@hospital.local` / `DoctorPassword123!`
- **Patient 1:** `patient.john@hospital.local` / `PatientPassword123!`
- **Patient 2:** `patient.jane@hospital.local` / `PatientPassword123!`

---

## 8. API Verification Guide (curl Examples)

_(Note: pass `-k` to trust the self-signed TLS certificate)._

### 1. Health, Readiness & Metrics

```bash
# Liveness probe
curl -k -i https://localhost/health

# Readiness probe (verifies MongoDB ping)
curl -k -i https://localhost/ready

# HTTP to HTTPS redirect verification (returns HTTP 301)
curl -i http://localhost/health

# Prometheus metrics
curl -k https://localhost/metrics
```

### 2. Authentication (Login)

```bash
# Login as Patient John
curl -k -s -X POST https://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient.john@hospital.local","password":"PatientPassword123!"}'
```

Save the `token` from the JSON response:

```bash
export TOKEN="<PASTE_RETURNED_JWT_TOKEN>"
```

### 3. List Doctors & Available 30-Minute Slots

```bash
# Retrieve doctor list
curl -k -s https://localhost/doctors

# Retrieve available slots for a specific doctor
curl -k -s "https://localhost/doctors/<DOCTOR_ID>/slots?date=2026-11-20"
```

### 4. Book Appointment (HTTP 201 Created)

```bash
curl -k -i -X POST https://localhost/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "<DOCTOR_ID>",
    "slotTime": "2026-11-20T10:00:00.000Z",
    "reason": "Cardiology Consultation"
  }'
```

### 5. Double-Booking Concurrency Conflict (HTTP 409 Conflict)

Re-send the exact same booking request:

```bash
curl -k -i -X POST https://localhost/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "<DOCTOR_ID>",
    "slotTime": "2026-11-20T10:00:00.000Z",
    "reason": "Double-booking collision attempt"
  }'
```

**Response:**

```json
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8

{
  "error": "Conflict",
  "code": "SLOT_ALREADY_BOOKED",
  "message": "The requested doctor already has a confirmed appointment at this slot time."
}
```

### 6. Reschedule Appointment

```bash
curl -k -i -X PUT https://localhost/appointments/<APPOINTMENT_ID>/reschedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slotTime":"2026-11-20T11:00:00.000Z"}'
```

### 7. Cancel Appointment

```bash
curl -k -i -X POST https://localhost/appointments/<APPOINTMENT_ID>/cancel \
  -H "Authorization: Bearer $TOKEN"
```

_(Cancelling sets status to `cancelled`, instantly releasing the slot in the partial unique index)._

---

## 9. Operational Runbooks & Command Reference

Both Bash (`.sh`) and PowerShell (`.ps1`) variants are provided for cross-platform operations:

| Action            | Bash Command                  | PowerShell Command             | Description                                   |
| :---------------- | :---------------------------- | :----------------------------- | :-------------------------------------------- |
| **Backup**        | `./scripts/backup.sh`         | `.\scripts\backup.ps1`         | Creates gzip compressed dump under `backups/` |
| **Restore**       | `./scripts/restore.sh <FILE>` | `.\scripts\restore.ps1 <FILE>` | Drops collections and restores from archive   |
| **Deploy**        | `./scripts/deploy.sh <TAG>`   | `.\scripts\deploy.ps1 <TAG>`   | Pulls tag, restarts compose, polls `/ready`   |
| **Rollback**      | `./scripts/rollback.sh <TAG>` | `.\scripts\rollback.ps1 <TAG>` | Reverts image tag and validates health        |
| **Failure Drill** | `./scripts/failure_drill.sh`  | `.\scripts\failure_drill.ps1`  | Simulates Mongo & App outages and recovery    |
| **TLS Certs**     | `./scripts/gen-certs.sh`      | `.\scripts\gen-certs.ps1`      | Generates self-signed certificates            |

_(For comprehensive incident response protocols and troubleshooting trees, refer to [docs/RUNBOOK.md](./docs/RUNBOOK.md))._

---

## 10. CI/CD & GitHub Push Instructions

To push this repository to GitHub and run the automated GitHub Actions CI/CD pipeline:

### Step 1: Create GitHub Repository

Create a new, empty repository on [GitHub](https://github.com/new) named `hospital-management-platform` (do not initialize with README or license).

### Step 2: Grant Workflow Permissions

1. Navigate to your repository's **Settings** > **Actions** > **General**.
2. Scroll to **Workflow permissions**.
3. Select **"Read and write permissions"** (enables GHCR package publishing).
4. Click **Save**.

### Step 3: Push Local Branch

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/hospital-management-platform.git
git branch -M main
git push -u origin main
```

_(Optional: Push a release tag to trigger semver container image publishing)_:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 11. Empirical Evidence & Acceptance Checklist

All operational verifications were conducted live against the containerized platform and stored in the [evidence/](./evidence/) directory:

| Requirement / Milestone                                       | Satisfying File(s)                                                                                                                                                                                   | Evidence Artifact                                                                                                                                                       | Verification Status |
| :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
| **GET /health & GET /ready (503 on DB disconnect)**           | [src/routes/health.js](./src/routes/health.js), [src/db.js](./src/db.js)                                                                                                                             | [failure-recovery-transcript.txt](./evidence/failure-recovery-transcript.txt)                                                                                           | **Verified**        |
| **JWT Authentication & RBAC (Admin/Doctor/Patient)**          | [src/middleware/auth.js](./src/middleware/auth.js), [src/routes/auth.js](./src/routes/auth.js)                                                                                                       | [test-output.txt](./evidence/test-output.txt)                                                                                                                           | **Verified**        |
| **Patient Appointment Isolation (403 on Cross-Access)**       | [src/middleware/auth.js](./src/middleware/auth.js), [src/routes/appointments.js](./src/routes/appointments.js)                                                                                       | [test-output.txt](./evidence/test-output.txt)                                                                                                                           | **Verified**        |
| **Doctor Availability & 30-min Slot Engine**                  | [src/services/slotValidator.js](./src/services/slotValidator.js), [src/routes/doctors.js](./src/routes/doctors.js)                                                                                   | [test-output.txt](./evidence/test-output.txt)                                                                                                                           | **Verified**        |
| **Concurrency Lock (10 Parallel Bookings -> 1x 201, 9x 409)** | [src/models/Appointment.js](./src/models/Appointment.js), [src/middleware/errorHandler.js](./src/middleware/errorHandler.js)                                                                         | [concurrency-test-output.txt](./evidence/concurrency-test-output.txt)                                                                                                   | **Verified**        |
| **Reschedule Conflict Handling (11000 -> 409)**               | [src/routes/appointments.js](./src/routes/appointments.js)                                                                                                                                           | [test-output.txt](./evidence/test-output.txt)                                                                                                                           | **Verified**        |
| **Audit Events Trail (Login, Book, Reschedule, Cancel)**      | [src/models/AuditEvent.js](./src/models/AuditEvent.js), [src/services/auditService.js](./src/services/auditService.js)                                                                               | [backup-restore-transcript.txt](./evidence/backup-restore-transcript.txt)                                                                                               | **Verified**        |
| **Synthetic Data Seed Script (Zero Real Data)**               | [scripts/seed.js](./scripts/seed.js)                                                                                                                                                                 | [backup-restore-transcript.txt](./evidence/backup-restore-transcript.txt)                                                                                               | **Verified**        |
| **Structured JSON Logging & X-Request-Id Tracing**            | [src/logger.js](./src/logger.js)                                                                                                                                                                     | Live curl & container logs                                                                                                                                              | **Verified**        |
| **Prometheus /metrics Endpoint**                              | [src/metrics.js](./src/metrics.js), [src/routes/health.js](./src/routes/health.js)                                                                                                                   | Live curl `/metrics`                                                                                                                                                    | **Verified**        |
| **Multi-Stage Dockerfile (Alpine, Non-Root)**                 | [Dockerfile](./Dockerfile), [.dockerignore](./.dockerignore)                                                                                                                                         | [image-digest.txt](./evidence/image-digest.txt)                                                                                                                         | **Verified**        |
| **Docker Compose Architecture & Network Isolation**           | [docker-compose.yml](./docker-compose.yml)                                                                                                                                                           | [docker-compose-ps.txt](./evidence/docker-compose-ps.txt)                                                                                                               | **Verified**        |
| **MongoDB Least Privilege Authentication**                    | [mongo-init/01-init-mongo.js](./mongo-init/01-init-mongo.js)                                                                                                                                         | Verified during stack initialization                                                                                                                                    | **Verified**        |
| **Nginx Reverse Proxy & TLS (Port 80 -> 443 Redirect)**       | [nginx/nginx.conf](./nginx/nginx.conf), [scripts/gen-certs.sh](./scripts/gen-certs.sh)                                                                                                               | Live curl HTTP 301 & HTTPS 200                                                                                                                                          | **Verified**        |
| **Zero Committed Secrets & Strict .gitignore**                | [.env.example](./.env.example), [.gitignore](./.gitignore)                                                                                                                                           | Git tree clean, zero secrets committed                                                                                                                                  | **Verified**        |
| **CI/CD Pipeline (Lint, Test, Audit, Trivy, GHCR)**           | [.github/workflows/ci.yml](./.github/workflows/ci.yml)                                                                                                                                               | [Pipeline Run #43736904732](https://github.com/vishi122/hospital-management-platform/actions/runs/43736904732) (`ghcr.io/vishi122/hospital-management-platform:v1.0.0`) | **Verified**        |
| **Deployment with /ready Health Polling**                     | [scripts/deploy.sh](./scripts/deploy.sh), [scripts/deploy.ps1](./scripts/deploy.ps1)                                                                                                                 | Verified deployment loop                                                                                                                                                | **Verified**        |
| **Backup & Drop-and-Restore Disaster Recovery**               | [scripts/backup.sh](./scripts/backup.sh), [scripts/restore.sh](./scripts/restore.sh)                                                                                                                 | [backup-restore-transcript.txt](./evidence/backup-restore-transcript.txt)                                                                                               | **Verified**        |
| **Rollback Automation**                                       | [scripts/rollback.sh](./scripts/rollback.sh), [scripts/rollback.ps1](./scripts/rollback.ps1)                                                                                                         | Verified image tag switch                                                                                                                                               | **Verified**        |
| **Failure Simulation Drill (503 & 502/504 Recovery)**         | [scripts/failure_drill.sh](./scripts/failure_drill.sh), [scripts/failure_drill.ps1](./scripts/failure_drill.ps1)                                                                                     | [failure-recovery-transcript.txt](./evidence/failure-recovery-transcript.txt)                                                                                           | **Verified**        |
| **Comprehensive Documentation Suite**                         | [README.md](./README.md), [docs/RUNBOOK.md](./docs/RUNBOOK.md), [docs/architecture.md](./docs/architecture.md), [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md), [docs/AI_USAGE.md](./docs/AI_USAGE.md) | Full documentation suite                                                                                                                                                | **Verified**        |

---

## 12. Known Limitations & Production Roadmap

1. **Self-Signed Certificates:** The local environment uses self-signed OpenSSL certificates. In cloud production (Kubernetes or AWS ECS), certificates should be managed via Let's Encrypt / Certbot with Cert-Manager or AWS ACM terminated at an Application Load Balancer / Cloudflare edge.
2. **Single MongoDB Node:** The database runs as a standalone pinned MongoDB 7 container with persistent named volumes. Production deployments should transition to a 3-node MongoDB Replica Set or managed MongoDB Atlas with continuous oplog backup and point-in-time recovery.
3. **Audit Log Persistence:** Audit records are written directly to MongoDB's `auditevents` collection. In an enterprise healthcare compliance architecture, audit streams should be dual-written or forwarded to an append-only immutable store (e.g. AWS CloudWatch / S3 Glacier with Object Lock).
4. **Horizontal Pod Autoscaling:** The Express application is entirely stateless and ready for horizontal replica scaling (HPA) behind Nginx or a Kubernetes Ingress Controller.
