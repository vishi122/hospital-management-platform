# PowerShell Rollback Script
param(
    [Parameter(Mandatory=$true)]
    [string]$PreviousTag
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=========================================================="
Write-Host "Initiating ROLLBACK to previous image tag: $PreviousTag"
Write-Host "Started at $(Get-Date -Format 'o')"
Write-Host "=========================================================="

& (Join-Path $scriptDir "deploy.ps1") -TargetImage $PreviousTag

Write-Host "=========================================================="
Write-Host "ROLLBACK COMPLETED AND VERIFIED"
Write-Host "=========================================================="
