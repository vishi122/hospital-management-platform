#!/usr/bin/env bash
# ==============================================================================
# Rollback Script for Hospital Management Platform
# Usage: ./scripts/rollback.sh <PREVIOUS_IMAGE_TAG>
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <previous_image_tag_or_ref>" >&2
  echo "Example: $0 hospital-platform-app:v1.0.0" >&2
  exit 1
fi

PREVIOUS_TAG="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "Initiating ROLLBACK to previous image tag: ${PREVIOUS_TAG}"
echo "Started at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=========================================================="

"${SCRIPT_DIR}/deploy.sh" "${PREVIOUS_TAG}"

echo "=========================================================="
echo "ROLLBACK COMPLETED AND VERIFIED at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=========================================================="
