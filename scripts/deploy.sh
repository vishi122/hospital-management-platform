#!/usr/bin/env bash
# ==============================================================================
# Deployment Script for Hospital Management Platform
# Usage: ./scripts/deploy.sh <IMAGE_TAG_OR_FULL_REF>
# ==============================================================================
set -euo pipefail

TARGET_IMAGE="${1:-hospital-platform-app:latest}"
MAX_RETRIES=30
RETRY_INTERVAL=2

# Determine docker compose command (supports both v2 plugin and v1 standalone)
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' found in PATH." >&2
  exit 1
fi

echo "=========================================================="
echo "Starting deployment at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Target Image: ${TARGET_IMAGE}"
echo "=========================================================="

export APP_IMAGE="${TARGET_IMAGE}"

# Check for SSL certificates before starting
CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../nginx/certs" && pwd)"
if [[ ! -f "${CERTS_DIR}/server.crt" || ! -f "${CERTS_DIR}/server.key" ]]; then
  echo "==> Missing TLS certificates in nginx/certs. Generating self-signed certs..."
  "$(dirname "${BASH_SOURCE[0]}")/gen-certs.sh"
fi

# Pull the target image if pulling from a remote registry
if [[ "${TARGET_IMAGE}" == *"/"* ]]; then
  echo "==> Pulling target image: ${TARGET_IMAGE}..."
  docker pull "${TARGET_IMAGE}" || echo "Warning: Image pull failed; continuing with local or cached image"
fi

echo "==> Deploying services with ${DOCKER_COMPOSE}..."
${DOCKER_COMPOSE} up -d --remove-orphans

echo "==> Polling https://localhost/ready until service is healthy..."
READY_URL="https://localhost/ready"
ATTEMPT=1
SUCCESS=0

while [ ${ATTEMPT} -le ${MAX_RETRIES} ]; do
  # Poll readiness via HTTPS (curl -k allows self-signed cert)
  HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "${READY_URL}" || echo "000")

  if [ "${HTTP_CODE}" = "200" ]; then
    echo "==> [Attempt ${ATTEMPT}/${MAX_RETRIES}] HTTP 200 OK! Service is ready and healthy."
    SUCCESS=1
    break
  else
    echo "==> [Attempt ${ATTEMPT}/${MAX_RETRIES}] Received HTTP ${HTTP_CODE}. Waiting ${RETRY_INTERVAL}s..."
    sleep ${RETRY_INTERVAL}
    ATTEMPT=$((ATTEMPT + 1))
  fi
done

if [ ${SUCCESS} -eq 1 ]; then
  echo "=========================================================="
  echo "DEPLOYMENT SUCCEEDED at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  ${DOCKER_COMPOSE} ps
  echo "=========================================================="
  exit 0
else
  echo "=========================================================="
  echo "DEPLOYMENT FAILED: /ready did not return 200 within timeout."
  echo "==> Container status:"
  ${DOCKER_COMPOSE} ps
  echo "==> Recent app logs:"
  ${DOCKER_COMPOSE} logs --tail=50 app
  echo "=========================================================="
  exit 1
fi
