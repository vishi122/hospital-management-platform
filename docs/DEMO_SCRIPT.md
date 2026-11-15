# 3–5 Minute Technical Demo Script: Hospital Management Platform

This script is structured for an interview, technical evaluation, or project presentation demonstrating the production-style DevOps architecture, automated CI/CD pipeline, and operational reliability features.

---

## Submission Evidence Reference

- **Pipeline Run:** [https://github.com/vishi122/hospital-management-platform/actions/runs/43736904732](https://github.com/vishi122/hospital-management-platform/actions/runs/43736904732)
- **Container Image:** `ghcr.io/vishi122/hospital-management-platform:v1.0.0`
- **Image Digest:** `sha256:b8f2089851d1d2ed20557747e17d8d6cf3f0dabc7c2139ad9224a0807d8626e4`
- **Demo Video:** `<add after recording>`
- **Demo Type:** local-only (no live URL)

---

## Demo Timeline Overview

- **Minute 0:00 – 1:00:** Architecture, CI/CD Pipeline & Zero-Trust Secrets
- **Minute 1:00 – 2:00:** Stack Deployment, TLS Termination & Health Verification
- **Minute 2:00 – 3:00:** Core API, RBAC & MongoDB Concurrency Locking (HTTP 409)
- **Minute 3:00 – 4:00:** Live Failure Drill (MongoDB Outage & Self-Healing Detection)
- **Minute 4:00 – 4:45:** Disaster Recovery (Backup & Drop-Restore Verification)

---

## Detailed Step-by-Step Walkthrough

### Part 1: CI/CD Pipeline & Architecture (0:00 – 1:00)

**Speaker Narrative:**

> _"Welcome! Today I am presenting the Hospital Management Platform MVP, engineered with a focus on production reliability, containerized security, and CI/CD automation. The application is built on Node.js 22 and Express with MongoDB 7 and Nginx as the fronting reverse proxy. Notice that neither Node nor MongoDB publish ports to the host; only Nginx terminates TLS on ports 80 and 443."_

**Show Code:**

- Open `.github/workflows/ci.yml`.
- Highlight key stages:
  1. Automated linting & Prettier formatting checks.
  2. Integration & concurrency test execution against a live MongoDB service container.
  3. Security gating: `npm audit --audit-level=high` and Trivy container vulnerability scanning.
  4. Buildx caching and publishing tagged images to GHCR using least-privilege `packages: write` permissions.

---

### Part 2: Deployment & Health Probes (1:00 – 2:00)

**Speaker Narrative:**

> _"Let's start the full stack locally using Docker Compose. Certificates are generated automatically, MongoDB authentication is provisioned with least-privilege database permissions, and our healthchecks gate the dependent containers."_

**Execute Command:**

```bash
# Generate TLS certificates
./scripts/gen-certs.sh

# Launch the stack
docker compose up -d --build

# Verify healthy status
docker compose ps
```

**Verify Health Endpoints:**

```bash
# 1. Verify HTTP to HTTPS 301 redirect
curl -I http://localhost/health

# 2. Check Liveness Probe (HTTP 200 OK)
curl -k https://localhost/health

# 3. Check Dynamic Database Readiness Probe (HTTP 200 OK)
curl -k https://localhost/ready
```

---

### Part 3: Business Logic & Concurrency Collision (2:00 – 3:00)

**Speaker Narrative:**

> _"The core service enforces Doctor Appointment scheduling. Let's authenticate as a patient and observe how the system handles concurrent double-booking race conditions at the database layer using a MongoDB partial unique index."_

**Execute Command:**

```bash
# 1. Login as patient
curl -k -s -X POST https://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient.john@hospital.local","password":"PatientPassword123!"}'

# 2. Query Doctor Slots
curl -k -s https://localhost/doctors

# 3. Book a slot
# First booking succeeds (201 Created)
# Duplicate booking for same doctor & slot immediately returns HTTP 409 Conflict:
# {"error":"Conflict","code":"SLOT_ALREADY_BOOKED"}
```

---

### Part 4: Resilience & Failure Drill (3:00 – 4:00)

**Speaker Narrative:**

> _"Now let's simulate a database outage to prove our readiness probe detects failures in real time and that the system recovers automatically without restarting the application."_

**Execute Command:**

```bash
# Execute automated failure drill
./scripts/failure_drill.sh
```

**Point Out to Evaluator:**

- `hospital_mongo` is stopped.
- `GET /ready` returns `HTTP 503 Degraded` with `database: disconnected`.
- Application logs show warning without crashing.
- `hospital_mongo` is restarted.
- `/ready` recovers automatically to `HTTP 200 OK`.

---

### Part 5: Backup & Disaster Recovery (4:00 – 4:45)

**Speaker Narrative:**

> _"Finally, let's verify our disaster recovery pipeline. We take a live binary snapshot using mongodump, drop the data, and restore from the archive."_

**Execute Command:**

```bash
# 1. Run Backup
./scripts/backup.sh

# 2. Simulate accidental data loss (delete appointments)
docker compose exec -T mongo mongosh -u rootadmin -p rootpassword_demo_mode --authenticationDatabase admin --quiet --eval "
  db.getSiblingDB('hospital_db').appointments.deleteMany({});
  print('Appointments remaining: ' + db.getSiblingDB('hospital_db').appointments.countDocuments());
"

# 3. Restore from Backup
./scripts/restore.sh backups/<latest_backup_file>.gz
```

**Conclusion:**

> _"All appointments and audit logs are fully restored. The stack is clean, robust, and observable. Thank you!"_
