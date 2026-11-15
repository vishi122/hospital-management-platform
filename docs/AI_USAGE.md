# AI Usage Declaration

This project was developed with assistance from **Antigravity**, an agentic AI coding assistant developed by the Google DeepMind team.

---

## 1. Scope of AI Assistance

Antigravity was utilized for the following aspects of the project:

| Task / Domain                  | Specific AI Contribution                                                                                                                                                 | Human Validation & Verification                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Architecture Design**        | Drafting the zero-trust container architecture, Nginx TLS termination layout, and Docker network topology.                                                               | Reviewed against assignment constraints (Node 22 + MongoDB + Nginx, no Python, no Postgres).                   |
| **API & Database Engineering** | Implementing the Mongoose partial unique index (`{ doctorId: 1, slotTime: 1 }` with `status: "confirmed"`), error code 11000 handling, and UTC slot alignment validator. | Verified index build at boot; tested edge cases (09:00 - 17:00, 30-min alignment, cancellation slot release).  |
| **Concurrency Testing**        | Designing the Jest + Supertest concurrency test harness using `Promise.all` with $N=10$ parallel requests.                                                               | Executed against real MongoDB container; verified exactly one 201 Created and nine 409 Conflicts.              |
| **Containerization**           | Crafting the multi-stage Dockerfile (`node:22.14.0-alpine`), unprivileged `node` user configuration, and Docker Compose healthchecks.                                    | Inspected layer sizes; tested `docker compose up --build` from clean clone.                                    |
| **CI/CD Pipeline**             | Creating `.github/workflows/ci.yml` incorporating linting, MongoDB service container tests, `npm audit`, Trivy container scanning, and GHCR publishing.                  | Verified least-privilege `permissions:`, GITHUB_TOKEN authentication, and digest output.                       |
| **Operations & Resilience**    | Authoring shell and PowerShell scripts for backup (`mongodump`), restore (`mongorestore --drop`), rollback, and failure drills.                                          | Executed live drills: stopped MongoDB, observed 503, restored to 200, verified dropped collection restoration. |
| **Documentation**              | Structuring the comprehensive `README.md`, `RUNBOOK.md`, `architecture.md` (Mermaid diagrams), and `DEMO_SCRIPT.md`.                                                     | Validated all curl commands, port mappings, and troubleshooting steps.                                         |

---

## 2. Integrity and Ethics Statement

- **Zero Real Data / Zero Leaked Secrets:** All datasets used in this project are 100% synthetic. No real patient data, medical records, or sensitive secrets were generated or committed.
- **Code Authorship & Understanding:** All generated code was thoroughly reviewed, verified in execution, and formatted. The implementer possesses full operational comprehension of all modules and can explain every architectural decision during technical interviews.
