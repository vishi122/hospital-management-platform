#!/usr/bin/env bash
# ==============================================================================
# Database Backup Script for MongoDB
# Dumps database into backups/ with a timestamped gzip archive
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date -u '+%Y%m%d_%H%M%SZ')
BACKUP_FILE="${BACKUP_DIR}/mongo_backup_${TIMESTAMP}.gz"

# Detect docker compose executable
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

# Load environment defaults if .env exists
MONGO_USER="${MONGO_ROOT_USERNAME:-rootadmin}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:-rootpassword_demo_mode}"
MONGO_DB="${MONGO_DATABASE:-hospital_db}"

echo "=========================================================="
echo "Starting MongoDB backup at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Target: ${BACKUP_FILE}"
echo "=========================================================="

${COMPOSE} exec -T mongo mongodump \
  --username "${MONGO_USER}" \
  --password "${MONGO_PASS}" \
  --authenticationDatabase admin \
  --db "${MONGO_DB}" \
  --archive \
  --gzip > "${BACKUP_FILE}"

if [[ -f "${BACKUP_FILE}" && -s "${BACKUP_FILE}" ]]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "==> Backup completed successfully!"
  echo "    Archive: ${BACKUP_FILE}"
  echo "    Size:    ${SIZE}"
  exit 0
else
  echo "==> ERROR: Backup file was not created or is empty!" >&2
  exit 1
fi
