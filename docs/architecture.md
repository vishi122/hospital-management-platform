# Architecture Specification: Hospital Management Platform

This document describes the architectural topology, security boundaries, request life cycles, and deployment pipeline for the **Doctor Appointment & Hospital Management Platform**.

---

## 1. High-Level Architecture Overview

The system is deployed as a resilient, multi-tiered containerized architecture managed via Docker Compose and orchestrated via a zero-trust network model.

```mermaid
flowchart TD
    subgraph Public_Internet["Public Internet / Client Layer"]
        Client["Client / Browser / curl"]
    end

    subgraph Host_Gateway["Host Gateway (Public Ports 80 / 443)"]
        Nginx["Nginx Reverse Proxy & TLS Termination\n(nginx:1.27.4-alpine)\nPorts: 80 -> 443 (301 Redirect)"]
    end

    subgraph Internal_Network["Isolated Docker Network (hospital_network)"]
        direction TB
        App["Doctor Appointment API\n(Node.js 22 Alpine - Express)\nUser: node (UID 1000)\nPort 3000 (Internal Only)"]
        Mongo["MongoDB 7.0 Service\n(mongo:7.0.15)\nAuth: SCRAM-SHA-256\nPort 27017 (Internal Only)"]
        Volume[("Persistent Storage\nNamed Volume: hospital_mongo_data\n(/data/db)")]
    end

    subgraph CICD_Pipeline["CI/CD Pipeline (GitHub Actions & GHCR)"]
        GitPush["git push / tag (v*)"] --> LintTest["1. Lint & Test\nESLint + Prettier + Jest"]
        LintTest --> Security["2. Security Scans\nnpm audit + Trivy Scan"]
        Security --> BuildPush["3. Build & Publish\nDocker Buildx -> GHCR"]
        BuildPush --> Deploy["4. Deploy Script\nscripts/deploy.sh"]
    end

    Client -->|HTTPS :443| Nginx
    Client -->|HTTP :80| Nginx
    Nginx -->|HTTP Proxy :3000| App
    App -->|Mongoose / TCP :27017| Mongo
    Mongo --- Volume
    Deploy -.->|Pulls from GHCR & Deploys| App

    classDef public fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef proxy fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef app fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef db fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    class Client public;
    class Nginx proxy;
    class App app;
    class Mongo,Volume db;
```

---

## 2. Component Breakdown

### 2.1 Edge & Ingress: Nginx Reverse Proxy

- **Role:** Single ingress point into the host.
- **Port Strategy:** Only Nginx binds to host interfaces:
  - Port `80`: Redirects all HTTP traffic to HTTPS via HTTP `301 Moved Permanently`.
  - Port `443`: Terminates TLS using modern ciphers (TLSv1.2 & TLSv1.3).
- **Security & Headers:**
  - Enforces `HSTS`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.
  - Injects `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`.
  - Propagates `X-Request-Id` for distributed end-to-end tracing.

### 2.2 Application Service: Express Doctor Appointment API

- **Runtime:** Node.js 22 Alpine (`node:22.14.0-alpine`), execution pinned to unprivileged user `node` (UID 1000).
- **Network Isolation:** Does not publish any ports to the host interface (`expose: 3000` only within the internal Docker bridge network).
- **Logging:** Structured JSON output powered by `pino` with automated correlation IDs (`X-Request-Id`).
- **Telemetry:** Prometheus scrape target exposed on `/metrics`.
- **Health System:**
  - Liveness (`GET /health`): Returns 200 indicating the Node event loop and HTTP server are responsive.
  - Readiness (`GET /ready`): Executes a dynamic database ping (`db.command({ ping: 1 })`). Returns `200 OK` when connected, or `503 Service Unavailable` during database outage or degradation.

### 2.3 Persistence Layer: MongoDB 7

- **Image:** `mongo:7.0.15` (pinned tag).
- **Access Control:** Full authentication enabled (`rootadmin` administrative user + least-privilege `hospital_app` user restricted to `readWrite` on `hospital_db`).
- **Storage:** Managed persistent Docker named volume `hospital_mongo_data` mapped to `/data/db`.
- **Index Architecture:** Built during application startup before accepting traffic:
  - **Partial Unique Index:**
    ```javascript
    { doctorId: 1, slotTime: 1 }
    // unique: true, partialFilterExpression: { status: "confirmed" }
    ```
    This guarantees zero double-bookings for active appointments, while allowing canceled appointments to release the slot for re-booking.

---

## 3. Data Flow & Concurrency Safe Booking

The sequence below illustrates concurrent booking requests arriving for the identical doctor and time slot:

```mermaid
sequenceDiagram
    autonumber
    actor PatientA as Patient A
    actor PatientB as Patient B
    participant Nginx as Nginx (:443)
    participant App as Express API (:3000)
    participant Mongo as MongoDB (:27017)

    Note over PatientA,PatientB: Concurrent booking requests for Dr. Smith at 10:00 UTC
    PatientA->>+Nginx: POST /appointments (Dr. Smith, 10:00)
    PatientB->>+Nginx: POST /appointments (Dr. Smith, 10:00)
    Nginx->>+App: Proxy Request A (X-Request-Id: trace-1)
    Nginx->>+App: Proxy Request B (X-Request-Id: trace-2)

    App->>Mongo: Validate Doctor & Patient exist
    Mongo-->>App: OK (200)

    par Parallel MongoDB Inserts
        App->>Mongo: db.appointments.insertOne(Doctor, 10:00, confirmed)
        App->>Mongo: db.appointments.insertOne(Doctor, 10:00, confirmed)
    end

    Note over Mongo: Partial Unique Index Enforced:\n{ doctorId: 1, slotTime: 1, status: "confirmed" }
    Mongo-->>App: Success (Insert A committed)
    Mongo-->>App: E11000 Duplicate Key Error (Insert B rejected)

    App-->>Nginx: 201 Created (Appointment A details)
    App-->>Nginx: 409 Conflict (SLOT_ALREADY_BOOKED)
    Nginx-->>-PatientA: HTTP 201 Created
    Nginx-->>-PatientB: HTTP 409 Conflict
```

---

## 4. CI/CD & Delivery Flow

```mermaid
flowchart LR
    Dev["Developer"] -->|git push main| Repo["GitHub Repo"]
    Repo --> Actions["GitHub Actions CI"]

    subgraph Test_Stage["Stage 1: Verify"]
        Actions --> Linter["ESLint & Prettier"]
        Actions --> ServiceMongo[("MongoDB 7 Container")]
        ServiceMongo --> Tests["Integration & Concurrency Tests"]
        Actions --> Audit["npm audit (high)"]
    end

    subgraph Build_Stage["Stage 2: Security & Build"]
        Tests --> Build["Docker Buildx (Cache: GHA)"]
        Build --> Trivy["Trivy Vulnerability Scan"]
    end

    subgraph Release_Stage["Stage 3: Release"]
        Trivy --> GHCR["Push to GHCR (ghcr.io)"]
    end

    subgraph Deploy_Stage["Stage 4: Operations"]
        GHCR --> DeployScript["scripts/deploy.sh"]
        DeployScript --> HealthPoll["Poll /ready -> 200 OK"]
    end
```
