# PowerShell script to generate self-signed TLS certificates for Nginx
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certsDir = Join-Path (Split-Path -Parent $scriptDir) "nginx\certs"

if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

$keyFile = Join-Path $certsDir "server.key"
$crtFile = Join-Path $certsDir "server.crt"

Write-Host "==> Generating self-signed TLS certificate for localhost..."

# Try to find openssl
$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslCmd) {
    if (Test-Path "C:\Program Files\Git\usr\bin\openssl.exe") {
        $opensslCmd = "C:\Program Files\Git\usr\bin\openssl.exe"
    } else {
        # Fallback to docker to generate certificates if host openssl is absent
        Write-Host "==> OpenSSL not found locally, generating via alpine docker container..."
        docker run --rm -v "${certsDir}:/certs" alpine sh -c "apk add --no-cache openssl >/dev/null 2>&1 && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/server.key -out /certs/server.crt -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,DNS:nginx,IP:127.0.0.1'"
        Write-Host "==> Certificates generated via Docker at $certsDir"
        exit 0
    }
}

& $opensslCmd req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout $keyFile `
  -out $crtFile `
  -subj "/C=US/ST=State/L=City/O=HospitalPlatform/OU=DevOps/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,DNS:nginx,IP:127.0.0.1"

Write-Host "==> Certificates generated successfully:"
Write-Host "    $crtFile"
Write-Host "    $keyFile"
