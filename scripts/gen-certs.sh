#!/usr/bin/env bash
# ==============================================================================
# Generate Self-Signed TLS Certificates for Nginx Reverse Proxy
# DO NOT COMMIT GENERATED CERTIFICATES TO SOURCE CONTROL
# ==============================================================================
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../nginx/certs" && pwd)"
mkdir -p "${CERTS_DIR}"

KEY_FILE="${CERTS_DIR}/server.key"
CRT_FILE="${CERTS_DIR}/server.crt"

echo "==> Generating 2048-bit RSA Private Key and Self-Signed Certificate..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CRT_FILE}" \
  -subj "/C=US/ST=State/L=City/O=HospitalPlatform/OU=DevOps/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:nginx,IP:127.0.0.1"

chmod 600 "${KEY_FILE}"
chmod 644 "${CRT_FILE}"

echo "==> Self-signed certificate generated successfully:"
echo "    Certificate: ${CRT_FILE}"
echo "    Private Key: ${KEY_FILE}"
