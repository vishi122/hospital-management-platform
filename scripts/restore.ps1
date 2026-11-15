# PowerShell MongoDB Restore Script
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

$user = if ($env:MONGO_ROOT_USERNAME) { $env:MONGO_ROOT_USERNAME } else { "rootadmin" }
$pass = if ($env:MONGO_ROOT_PASSWORD) { $env:MONGO_ROOT_PASSWORD } else { "replace_with_strong_root_password" }
$db = if ($env:MONGO_DATABASE) { $env:MONGO_DATABASE } else { "hospital_db" }

Write-Host "=========================================================="
Write-Host "Starting MongoDB restore at $(Get-Date -Format 'o')"
Write-Host "Source: $BackupFile"
Write-Host "Database: $db"
Write-Host "=========================================================="

# Copy host archive into container to preserve binary integrity
$containerRestoreFile = "/tmp/restore_$(Get-Random).gz"
docker cp $BackupFile "hospital_mongo:$containerRestoreFile"
docker exec hospital_mongo mongorestore -u $user -p $pass --authenticationDatabase admin --archive=$containerRestoreFile --gzip --drop
docker exec hospital_mongo rm -f $containerRestoreFile

Write-Host "==> Restore finished. Inspecting collections in $db..."
docker exec hospital_mongo mongosh -u $user -p $pass --authenticationDatabase admin --quiet --eval "
  const d = db.getSiblingDB('$db');
  print('    Users:        ' + d.users.countDocuments());
  print('    Doctors:      ' + d.doctors.countDocuments());
  print('    Appointments: ' + d.appointments.countDocuments());
  print('    AuditEvents:  ' + d.auditevents.countDocuments());
"
