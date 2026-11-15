# Cloud Deployment & CI/CD – Hospital Management Platform

A production-style Doctor Appointment API and operations repository engineered with Node.js 22, Express, MongoDB 7, and Nginx. This repository demonstrates production DevOps principles: multi-stage containerization, zero-trust network isolation, database-level concurrency locking, automated CI/CD with security gating, disaster recovery, and operational resilience drills.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Public Internet / Client        |
                      +---------------------------------------+
                                          |
                      +---------------------------------------+
                      |       Nginx Reverse Proxy & TLS       |
                      |  Ports: 80 (Redirect to 443) & 443    |
                      +---------------------------------------+
                                          | (Internal Docker Network)
                 +------------------------+------------------------+
                 |                                                 |
+----------------------------------+             +----------------------------------+
| Express Doctor Appointment API   |             | MongoDB 7.0 Persistence Cluster  |
| Image: node:22.14.0-alpine       |             | Image: mongo:7.0.15              |
| User: node (UID 1000, Non-Root)  | <=========> | Auth: Root + App Least-Privilege |
| Port: 3000 (Internal Only)       |             | Port: 27017 (Internal Only)      |
+----------------------------------+             +----------------------------------+
                                                                   |
                                                 +----------------------------------+
                                                 | Named Volume: hospital_mongo_data|
                                                 +----------------------------------+
```

### Key Highlights

- **Strict Network Isolation:** Only Nginx publishes ports (`80` and `443`). Express API (`3000`) and MongoDB (`27017`) reside exclusively on an internal bridge network.
- **Concurrency & Double-Booking Protection:** Guaranteed at the database layer via a MongoDB partial unique index on `{ doctorId: 1, slotTime: 1 }` with `partialFilterExpression: { status: "confirmed" }`. Concurrent booking collisions return `HTTP 409 Conflict`.
- **Zero Real Data / No Committed Secrets:** Uses 100% synthetic seed data. Secrets and certificates are strictly excluded via `.gitignore` and `.dockerignore`.
- **Observable by Design:** Structured JSON logging (`pino`) with correlation tracking via `X-Request-Id` headers and Prometheus metrics on `/metrics`.
- **CI/CD Pipeline:** GitHub Actions workflow featuring automated linting, test suites on a live MongoDB service container, `npm audit`, Trivy container scanning, Buildx layer caching, and automated publishing to GHCR.

---

## Port Map

| Component         | Container Name   | Host Port | Internal Port | Protocol    | Publicly Reachable?    | Purpose                         |
| ----------------- | ---------------- | --------- | ------------- | ----------- | ---------------------- | ------------------------------- |
| **Nginx (HTTP)**  | `hospital_nginx` | `80`      | `80`          | TCP / HTTP  | **Yes**                | Automatic 301 redirect to HTTPS |
| **Nginx (HTTPS)** | `hospital_nginx` | `443`     | `443`         | TCP / TLS   | **Yes**                | TLS termination & reverse proxy |
| **Express API**   | `hospital_app`   | _None_    | `3000`        | TCP / HTTP  | **No (Internal Only)** | Application API logic           |
| **MongoDB**       | `hospital_mongo` | _None_    | `27017`       | TCP / Mongo | **No (Internal Only)** | Database engine                 |

---

## Environment Variables

| Variable              | Default Value         | Required? | Description                                                 |
| --------------------- | --------------------- | --------- | ----------------------------------------------------------- |
| `NODE_ENV`            | `production`          | No        | Node environment mode (`production`, `development`, `test`) |
| `PORT`                | `3000`                | No        | Internal port for Express API                               |
| `MONGO_ROOT_USERNAME` | `rootadmin`           | Yes       | MongoDB administrator username                              |
| `MONGO_ROOT_PASSWORD` | _Random in .env_      | Yes       | MongoDB administrator password                              |
| `MONGO_APP_USERNAME`  | `hospital_app`        | Yes       | Least-privilege MongoDB app user                            |
| `MONGO_APP_PASSWORD`  | _Random in .env_      | Yes       | Least-privilege MongoDB app password                        |
| `MONGO_DATABASE`      | `hospital_db`         | Yes       | MongoDB database name                                       |
| `MONGO_URI`           | _Computed in compose_ | Yes       | Connection string used by Express app                       |
| `JWT_SECRET`          | _Random 32+ chars_    | Yes       | Symmetric secret key for signing JWTs                       |
| `JWT_EXPIRES_IN`      | `24h`                 | No        | Expiration duration for user sessions                       |
| `LOG_LEVEL`           | `info`                | No        | Pino logger level (`debug`, `info`, `warn`, `error`)        |
| `ENABLE_METRICS`      | `true`                | No        | Enable Prometheus metrics endpoint (`/metrics`)             |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) (v2+ recommended)
- [Git](https://git-scm.com/)
- [OpenSSL](https://www.openssl.org/) (for TLS certificate generation, or use the Docker-based fallback)
- [curl](https://curl.se/) (for manual API verification)

---

## Clean-Environment Setup & Run Steps

Follow these exact steps from a fresh clone:

### Step 1: Clone and Prepare Environment File

```bash
git clone <repo-url>
cd "cloudand devopsproject"

# Copy the configuration template to .env
cp .env.example .env
```

_(On Windows PowerShell: `Copy-Item .env.example .env`)_

### Step 2: Generate TLS Certificates

```bash
# On Linux / macOS / Git Bash:
./scripts/gen-certs.sh

# On Windows PowerShell:
.\scripts\gen-certs.ps1
```

This generates `server.key` and `server.crt` under `nginx/certs/` with SANs for `localhost`.

### Step 3: Launch Stack via Docker Compose

```bash
# Build the images and start containers in the background
docker compose up -d --build

# Verify that all 3 services report healthy status:
docker compose ps
```

### Step 4: Seed Synthetic Test Data

```bash
# Populate database with fake doctors, users, and slots
docker compose exec app node scripts/seed.js
```

---

## API Examples with `curl`

_(Note: use `-k` to accept the self-signed TLS certificate)._

### 1. Health & Readiness Probes

```bash
# Liveness probe
curl -k https://localhost/health

# Readiness probe (verifies dynamic MongoDB ping)
curl -k https://localhost/ready
```

### 2. Authentication (Login)

```bash
# Login as seeded synthetic patient John
curl -k -s -X POST https://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient.john@hospital.local","password":"PatientPassword123!"}'
```

_Save the returned `token` for subsequent calls:_

```bash
export TOKEN="<PASTE_TOKEN_HERE>"
```

### 3. List Doctors & Available Slots

```bash
# Retrieve all doctors
curl -k -s https://localhost/doctors

# Get available 30-minute slots for a doctor (replace ID with doctor's _id)
curl -k -s "https://localhost/doctors/<DOCTOR_ID>/slots?date=2026-11-20"
```

### 4. Book Appointment (201 Created)

```bash
# Book appointment at an aligned slot (e.g. 10:00 UTC)
curl -k -s -X POST https://localhost/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "<DOCTOR_ID>",
    "slotTime": "2026-11-20T10:00:00.000Z",
    "reason": "Cardiology Consultation"
  }'
```

### 5. Double-Booking Conflict Trigger (409 Conflict)

Repeat the exact same booking request above:

```bash
curl -k -i -X POST https://localhost/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "<DOCTOR_ID>",
    "slotTime": "2026-11-20T10:00:00.000Z",
    "reason": "Conflicting attempt"
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
curl -k -s -X PUT https://localhost/appointments/<APPOINTMENT_ID>/reschedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slotTime":"2026-11-20T11:00:00.000Z"}'
```

### 7. Cancel Appointment

```bash
curl -k -s -X POST https://localhost/appointments/<APPOINTMENT_ID>/cancel \
  -H "Authorization: Bearer $TOKEN"
```

_(Cancelling sets status to `cancelled`, freeing the partial index slot for new bookings)._

---

## Operational Scripts

| Script                     | Purpose                                                        | Execution                          |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `scripts/deploy.sh`        | Pulls image tag, restarts compose, polls `/ready` until 200 OK | `./scripts/deploy.sh <TAG>`        |
| `scripts/rollback.sh`      | Re-deploys previous tag and validates health                   | `./scripts/rollback.sh <PREV_TAG>` |
| `scripts/backup.sh`        | Dumps MongoDB into compressed timestamped archive              | `./scripts/backup.sh`              |
| `scripts/restore.sh`       | Drops conflicting collections and restores archive             | `./scripts/restore.sh <FILE>`      |
| `scripts/failure_drill.sh` | Simulates MongoDB outage (503) & recovery (200)                | `./scripts/failure_drill.sh`       |
| `scripts/gen-certs.sh`     | Generates self-signed TLS certificates                         | `./scripts/gen-certs.sh`           |

---

## CI/CD Pipeline (`.github/workflows/ci.yml`)

The GitHub Actions workflow triggers on `push` to `main`, tags matching `v*`, and all pull requests to `main`:

1. **Lint & Test:** Runs ESLint, Prettier format verification, and Jest test suite against a MongoDB 7 service container.
2. **Security Gating:** Executes `npm audit --audit-level=high` and Trivy vulnerability scanner on the built image.
3. **Build & Push:** Uses Docker Buildx with GitHub Actions layer caching (`type=gha`), tags image with Git SHA and version (`v*` or `run-<number>`), and publishes to GitHub Container Registry (`ghcr.io`).
4. **Zero-Trust Permissions:** Runs with read-only permissions by default; `packages: write` is isolated strictly to the publish job. Image digest is recorded in `$GITHUB_STEP_SUMMARY`.

---

## Rollback Procedure

When an outage or defect is detected post-deployment:

1. Identify the last known good image tag (from GHCR or Git tags).
2. Execute the rollback script:
   ```bash
   ./scripts/rollback.sh ghcr.io/<owner>/hospital-platform-app:v1.0.0
   ```
3. The script re-deploys the specified tag, runs healthchecks, and confirms database readiness.

---

## Known Limitations & Production Roadmap

1. **Self-Signed Certificates:** The local environment utilizes self-signed OpenSSL certificates. In production Kubernetes or cloud VM environments, automate certificates via Let's Encrypt / Certbot or an AWS ALB / Cloudflare ingress controller.
2. **Single-Node MongoDB:** Docker Compose runs a standalone MongoDB instance. Production deployments should utilize a replica set (e.g. MongoDB Atlas or a 3-node StatefulSet) with automated oplog tailing and cross-region backups.
3. **Horizontal Pod Autoscaling:** Currently scaled as a single container instance. The Express app is stateless and ready for horizontal scaling behind Nginx or a Kubernetes Ingress Controller.
