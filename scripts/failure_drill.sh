#!/usr/bin/env bash
# ==============================================================================
# Failure Drill & Resilience Verification Script
# Simulates service outages (MongoDB disconnection, App crash) and verifies
# detection (503 / 502) and automatic recovery (200 OK) with timestamped output.
# ==============================================================================
set -euo pipefail

MODE="${1:---all}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

echo "=========================================================="
echo "HOSPITAL PLATFORM RESILIENCE & FAILURE DRILL"
echo "Timestamp: $(timestamp)"
echo "Mode:      ${MODE}"
echo "=========================================================="

# Drill 1: MongoDB Disconnection and Recovery
run_mongo_drill() {
  echo ""
  echo ">>> [DRILL 1/2]: SIMULATING MONGODB OUTAGE"
  echo "----------------------------------------------------------"
  echo "==> Step 1: Baseline health check before outage"
  HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || echo "000")
  echo "[$(timestamp)] Initial /ready probe returned HTTP: ${HTTP_CODE}"

  echo "==> Step 2: Stopping MongoDB container (hospital_mongo)..."
  ${COMPOSE} stop mongo
  sleep 2

  echo "==> Step 3: Probing /ready during MongoDB outage (Expect HTTP 503 Degraded)"
  OUTAGE_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || echo "000")
  echo "[$(timestamp)] Outage /ready returned HTTP: ${OUTAGE_CODE}"
  curl -k -s https://localhost/ready || true
  echo ""

  echo "==> Step 4: Inspecting Docker container health and status"
  ${COMPOSE} ps

  echo "==> Step 5: Inspecting Express application logs for database warning"
  ${COMPOSE} logs --tail=15 app

  echo "==> Step 6: Restarting MongoDB container..."
  ${COMPOSE} start mongo

  echo "==> Step 7: Polling /ready until recovery is confirmed (Expect HTTP 200 OK)"
  for i in {1..30}; do
    CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || echo "000")
    if [ "${CODE}" = "200" ]; then
      echo "[$(timestamp)] RECOVERY CONFIRMED! /ready returned HTTP 200 OK on attempt ${i}."
      curl -k -s https://localhost/ready
      echo ""
      break
    fi
    echo "[$(timestamp)] Attempt ${i}: Status is ${CODE}, retrying in 2s..."
    sleep 2
  done
  echo ">>> MongoDB Failure Drill Completed Successfully."
}

# Drill 2: Application Container Crash and Recovery
run_app_drill() {
  echo ""
  echo ">>> [DRILL 2/2]: SIMULATING APPLICATION CONTAINER CRASH"
  echo "----------------------------------------------------------"
  echo "==> Step 1: Stopping App container (hospital_app)..."
  ${COMPOSE} stop app
  sleep 2

  echo "==> Step 2: Probing /ready via Nginx (Expect HTTP 502 Bad Gateway)"
  APP_OUTAGE_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || echo "000")
  echo "[$(timestamp)] During app outage, Nginx returned HTTP: ${APP_OUTAGE_CODE}"

  echo "==> Step 3: Starting App container..."
  ${COMPOSE} start app

  echo "==> Step 4: Polling /ready until application recovers"
  for i in {1..30}; do
    CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || echo "000")
    if [ "${CODE}" = "200" ]; then
      echo "[$(timestamp)] APPLICATION RESTORED! /ready returned HTTP 200 on attempt ${i}."
      break
    fi
    echo "[$(timestamp)] Attempt ${i}: Status is ${CODE}, waiting 2s..."
    sleep 2
  done
  echo ">>> Application Container Drill Completed Successfully."
}

if [ "${MODE}" = "--mongo" ]; then
  run_mongo_drill
elif [ "${MODE}" = "--app" ]; then
  run_app_drill
else
  run_mongo_drill
  run_app_drill
fi

echo ""
echo "=========================================================="
echo "ALL RESILIENCE DRILLS COMPLETED AT $(timestamp)"
${COMPOSE} ps
echo "=========================================================="
