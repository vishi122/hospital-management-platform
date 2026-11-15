# Operations & Reliability Runbook: Hospital Management Platform

This runbook contains operational workflows, disaster recovery procedures, incident response instructions, and troubleshooting tables for the Doctor Appointment & Hospital Management Platform.

---

## 1. Routine Service Management

All container operations are managed via Docker Compose (`docker compose` or `docker-compose`).

### 1.1 Start the Entire Stack

```bash
# Build images and start all three containers in daemon mode
docker compose up -d --build

# Verify all services reach healthy status
docker compose ps
```

### 1.2 Stop and Restart Services

```bash
# Stop all services gracefully
docker compose stop

# Start previously stopped services
docker compose start

# Restart a specific service (e.g. app or nginx)
docker compose restart app
docker compose restart nginx

# Tear down the stack without removing persistent data
docker compose down

# Tear down stack AND wipe named volumes (CAUTION: destroys data)
docker compose down -v
```

---

## 2. Viewing and Filtering Logs

All logs are emitted as structured JSON (powered by Pino).

### 2.1 Live Log Tailing

```bash
# Follow unified logs for all services
docker compose logs -f

# Follow logs for specific container with timestamps
docker compose logs -f --tail=100 app
docker compose logs -f nginx
docker compose logs -f mongo
```

### 2.2 Filtering Logs by Correlation ID (Request ID)

```bash
# Search for a specific request ID in the application logs
docker compose logs app | grep "requestId\":\"<YOUR_REQUEST_UUID>"
```

### 2.3 Scraping Prometheus Metrics

```bash
# Query the live metrics endpoint through Nginx
curl -k https://localhost/metrics
```

---

## 3. Deployment & Release Workflow

### 3.1 Deploying a New Image Tag

To deploy a new image tag pulled from GHCR or built locally:

```bash
# Syntax: ./scripts/deploy.sh <IMAGE_TAG>
./scripts/deploy.sh ghcr.io/username/hospital-platform-app:v1.1.0

# On Windows PowerShell:
.\scripts\deploy.ps1 -TargetImage "ghcr.io/username/hospital-platform-app:v1.1.0"
```

The script automatically:

1. Verifies/generates TLS certificates.
2. Pulls the target image from GHCR.
3. Invokes `docker compose up -d`.
4. Polls `https://localhost/ready` until `HTTP 200 OK` is confirmed (or aborts after timeout).

---

## 4. Rollback Workflow

If a faulty release is detected in production, initiate an immediate rollback to the previous verified stable tag.

### 4.1 Execute Rollback

```bash
# Linux / macOS / Bash:
./scripts/rollback.sh hospital-platform-app:v1.0.0

# Windows PowerShell:
.\scripts\rollback.ps1 -PreviousTag "hospital-platform-app:v1.0.0"
```

This re-deploys the specified tag, runs healthchecks, and confirms database readiness.

---

## 5. Database Backup and Restore Procedures

### 5.1 On-Demand Backup

Create a compressed binary dump of the MongoDB database:

```bash
# Bash:
./scripts/backup.sh

# PowerShell:
.\scripts\backup.ps1
```

Backups are archived into `backups/mongo_backup_<TIMESTAMP>.gz`.

### 5.2 Restoring from Backup

Restore an archived dump using `mongorestore --drop`:

```bash
# Bash:
./scripts/restore.sh backups/mongo_backup_20261115_120000Z.gz

# PowerShell:
.\scripts\restore.ps1 -BackupFile "backups\mongo_backup_20261115_120000Z.gz"
```

The script automatically drops existing conflicting collections and restores all documents and indexes cleanly.

---

## 6. Incident Response & Failure Drills

To verify resilience detection and automated recovery, execute the automated failure drill:

```bash
# Bash:
./scripts/failure_drill.sh

# PowerShell:
.\scripts\failure_drill.ps1
```

---

## 7. Troubleshooting Matrix

| Symptom                                    | Diagnostic Command                                                 | Root Cause                                                   | Remediation Step                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ready` returns `HTTP 503`                | `curl -k https://localhost/ready`<br>`docker compose logs mongo`   | MongoDB is unreachable or authentication failure             | 1. Check `docker compose ps mongo`<br>2. Restart MongoDB: `docker compose start mongo`<br>3. Verify credentials in `.env`                     |
| `HTTP 502 Bad Gateway` from Nginx          | `docker compose logs nginx`<br>`docker compose ps app`             | Express application container crashed or restarting          | 1. Check `docker compose logs app`<br>2. Look for uncaught exceptions or unhandled rejections<br>3. Restart app: `docker compose restart app` |
| `HTTP 409 Conflict` on appointment booking | `curl -k -X POST .../appointments`<br>`grep "SLOT_ALREADY_BOOKED"` | Concurrency collision: another user confirmed the slot       | Normal business logic behavior. Present slot as booked and prompt user to select an alternate slot.                                           |
| TLS Handshake Error on port 443            | `openssl s_client -connect localhost:443`                          | Missing or expired certificates in `nginx/certs/`            | Run `scripts/gen-certs.sh` and restart Nginx: `docker compose restart nginx`.                                                                 |
| Docker compose fails to bind port 80/443   | `netstat -ano \| findstr :443` (Win)<br>`lsof -i :443` (Linux)     | Host process (e.g. IIS, Apache, Skype) already occupies port | Stop conflicting process or rebind conflicting software on host.                                                                              |
| Container health status shows `unhealthy`  | `docker inspect --format='{{json .State.Health}}' hospital_app`    | Healthcheck timeout or failed ping command                   | Inspect healthcheck logs in `docker inspect`. Check container resource constraints.                                                           |
