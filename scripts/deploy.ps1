# PowerShell deployment script for Hospital Management Platform
param(
    [string]$TargetImage = "hospital-platform-app:latest"
)

$ErrorActionPreference = "Continue"

Write-Host "=========================================================="
Write-Host "Starting deployment at $(Get-Date -Format 'o')"
Write-Host "Target Image: $TargetImage"
Write-Host "=========================================================="

$env:APP_IMAGE = $TargetImage
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Check TLS certificates
$certsDir = Join-Path $rootDir "nginx\certs"
$crtFile = Join-Path $certsDir "server.crt"
if (-not (Test-Path $crtFile)) {
    Write-Host "==> Generating missing TLS certificates..."
    & (Join-Path $scriptDir "gen-certs.ps1")
}

# Determine docker-compose command
$composeCmd = "docker-compose"
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
} else {
    $composeCmd = "docker compose"
}

# Pull image if remote
if ($TargetImage -like "*/*") {
    Write-Host "==> Pulling target image: $TargetImage..."
    docker pull $TargetImage
}

Write-Host "==> Bringing up services with $composeCmd..."
Set-Location $rootDir
& $composeCmd up -d --remove-orphans

Write-Host "==> Polling https://localhost/ready until service is healthy..."
$maxAttempts = 30
$attempt = 1
$success = $false

# Bypass SSL certificate validation for self-signed certs in PowerShell
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

while ($attempt -le $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "https://localhost/ready" -SkipCertificateCheck -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "==> [Attempt $attempt/$maxAttempts] HTTP 200 OK! Service is ready."
            $success = $true
            break
        } else {
            Write-Host "==> [Attempt $attempt/$maxAttempts] Received HTTP $($response.StatusCode). Waiting 2s..."
        }
    } catch {
        Write-Host "==> [Attempt $attempt/$maxAttempts] Service not ready yet. Waiting 2s..."
    }
    Start-Sleep -Seconds 2
    $attempt++
}

if ($success) {
    Write-Host "=========================================================="
    Write-Host "DEPLOYMENT SUCCEEDED"
    & $composeCmd ps
    Write-Host "=========================================================="
    exit 0
} else {
    Write-Host "=========================================================="
    Write-Host "DEPLOYMENT FAILED: /ready did not return 200 within timeout."
    & $composeCmd ps
    & $composeCmd logs --tail=50 app
    Write-Host "=========================================================="
    exit 1
}
