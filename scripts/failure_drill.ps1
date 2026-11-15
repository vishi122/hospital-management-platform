# PowerShell Failure Drill & Resilience Verification Script
param(
    [string]$Target = "all"
)

$ErrorActionPreference = "Continue"

$composeCmd = "docker-compose"
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
} else {
    $composeCmd = "docker compose"
}

function Get-Timestamp {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Query-Ready {
    $code = & curl.exe -k -s -o /dev/null -w "%{http_code}" https://localhost/ready
    return $code
}

Write-Host "=========================================================="
Write-Host "HOSPITAL PLATFORM RESILIENCE & FAILURE DRILL"
Write-Host "Timestamp: $(Get-Timestamp)"
Write-Host "Target:    $Target"
Write-Host "=========================================================="

if ($Target -eq "all" -or $Target -eq "mongo") {
    Write-Host ""
    Write-Host ">>> [DRILL 1/2]: SIMULATING MONGODB OUTAGE"
    Write-Host "----------------------------------------------------------"
    Write-Host "==> Step 1: Baseline health check before outage"
    $initialCode = Query-Ready
    Write-Host "[$((Get-Timestamp))] Initial /ready HTTP Status: $initialCode"

    Write-Host "==> Step 2: Stopping MongoDB container..."
    & $composeCmd stop mongo
    Start-Sleep -Seconds 2

    Write-Host "==> Step 3: Probing /ready during MongoDB outage (Expect HTTP 503)"
    $outageCode = Query-Ready
    Write-Host "[$((Get-Timestamp))] Outage /ready returned HTTP: $outageCode"
    & curl.exe -k -s https://localhost/ready
    Write-Host ""

    Write-Host "==> Step 4: Docker compose container status"
    & $composeCmd ps

    Write-Host "==> Step 5: Express app logs during database outage"
    & $composeCmd logs --tail=15 app

    Write-Host "==> Step 6: Restarting MongoDB container..."
    & $composeCmd start mongo

    Write-Host "==> Step 7: Polling /ready until recovery is confirmed (Expect HTTP 200)"
    $recovered = $false
    for ($i = 1; $i -le 30; $i++) {
        $code = Query-Ready
        if ($code -eq "200") {
            Write-Host "[$((Get-Timestamp))] RECOVERY CONFIRMED! /ready returned HTTP 200 OK on attempt ${i}."
            & curl.exe -k -s https://localhost/ready
            Write-Host ""
            $recovered = $true
            break
        }
        Write-Host "[$((Get-Timestamp))] Attempt ${i}: Status is $code, waiting 2s..."
        Start-Sleep -Seconds 2
    }
    Write-Host ">>> MongoDB Resilience Drill Completed."
}

if ($Target -eq "all" -or $Target -eq "app") {
    Write-Host ""
    Write-Host ">>> [DRILL 2/2]: SIMULATING APPLICATION CONTAINER CRASH"
    Write-Host "----------------------------------------------------------"
    Write-Host "==> Step 1: Stopping App container..."
    & $composeCmd stop app
    Start-Sleep -Seconds 2

    Write-Host "==> Step 2: Probing /ready via Nginx (Expect 502 Bad Gateway)"
    $appOutageCode = Query-Ready
    Write-Host "[$((Get-Timestamp))] During app outage, Nginx returned HTTP: $appOutageCode"

    Write-Host "==> Step 3: Restarting App container..."
    & $composeCmd start app

    Write-Host "==> Step 4: Polling /ready until app recovers"
    for ($i = 1; $i -le 30; $i++) {
        $code = Query-Ready
        if ($code -eq "200") {
            Write-Host "[$((Get-Timestamp))] APPLICATION RESTORED! /ready returned HTTP 200 on attempt ${i}."
            break
        }
        Write-Host "[$((Get-Timestamp))] Attempt ${i}: Status is $code, waiting 2s..."
        Start-Sleep -Seconds 2
    }
    Write-Host ">>> Application Container Resilience Drill Completed."
}

Write-Host ""
Write-Host "=========================================================="
Write-Host "ALL RESILIENCE DRILLS COMPLETED AT $(Get-Timestamp)"
& $composeCmd ps
Write-Host "=========================================================="
