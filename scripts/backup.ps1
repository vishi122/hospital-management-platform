# PowerShell MongoDB Backup Script
param(
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$backupDir = Join-Path $rootDir "backups"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
if (-not $OutputFile) {
    $OutputFile = Join-Path $backupDir "mongo_backup_$timestamp.gz"
}

$user = if ($env:MONGO_ROOT_USERNAME) { $env:MONGO_ROOT_USERNAME } else { "rootadmin" }
$pass = if ($env:MONGO_ROOT_PASSWORD) { $env:MONGO_ROOT_PASSWORD } else { "replace_with_strong_root_password" }
$db = if ($env:MONGO_DATABASE) { $env:MONGO_DATABASE } else { "hospital_db" }

Write-Host "=========================================================="
Write-Host "Starting MongoDB backup at $(Get-Date -Format 'o')"
Write-Host "Target: $OutputFile"
Write-Host "=========================================================="

# Execute mongodump directly to container /tmp then copy to host to prevent text-piping corruption
$containerTmpFile = "/tmp/dump_$timestamp.gz"
docker exec hospital_mongo mongodump -u $user -p $pass --authenticationDatabase admin --db $db --archive=$containerTmpFile --gzip
docker cp "hospital_mongo:$containerTmpFile" $OutputFile
docker exec hospital_mongo rm -f $containerTmpFile

if ((Test-Path $OutputFile) -and (Get-Item $OutputFile).Length -gt 0) {
    $sizeKb = [math]::Round((Get-Item $OutputFile).Length / 1KB, 2)
    Write-Host "==> Backup completed successfully!"
    Write-Host "    Archive: $OutputFile"
    Write-Host "    Size:    $sizeKb KB"
    exit 0
} else {
    Write-Error "Backup failed or generated empty archive"
    exit 1
}
