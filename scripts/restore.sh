#!/usr/bin/env bash
# ==============================================================================
# Database Restore Script for MongoDB
# Usage: ./scripts/restore.sh <BACKUP_ARCHIVE_FILE>
# Restores collections using mongorestore --drop from a gzip archive
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' does not exist." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

MONGO_USER="${MONGO_ROOT_USERNAME:-rootadmin}"
MONGO_PASS="${MONGO_ROOT_PASSWORD:-rootpassword_demo_mode}"
MONGO_DB="${MONGO_DATABASE:-hospital_db}"

echo "=========================================================="
echo "Starting MongoDB restore at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Source File: ${BACKUP_FILE}"
echo "Target Database: ${MONGO_DB}"
echo "=========================================================="

${COMPOSE} exec -T mongo mongorestore \
  --username "${MONGO_USER}" \
  --password "${MONGO_PASS}" \
  --authenticationDatabase admin \
  --archive \
  --gzip \
  --drop < "${BACKUP_FILE}"

echo "==> Database restore completed successfully!"
echo "==> Current document counts in ${MONGO_DB}:"
${COMPOSE} exec -T mongo mongosh -u "${MONGO_USER}" -p "${MONGO_PASS}" --authenticationDatabase admin --quiet --eval "
  const db = db.getSiblingDB('${MONGO_DB}');
  print('    Users:        ' + db.users.countDocuments());
  print('    Doctors:      ' + db.doctors.countDocuments());
  print('    Appointments: ' + db.appointments.countDocuments());
  print('    AuditEvents:  ' + db.auditevents.countDocuments());
"
