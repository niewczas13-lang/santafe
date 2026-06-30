param(
  [string]$Morning = "08:00",
  [string]$Evening = "20:00"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "run-local-check.ps1"
$PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

function Register-SantaFeTask {
  param(
    [string]$TaskName,
    [string]$Time
  )

  $Action = New-ScheduledTaskAction `
    -Execute $PowerShell `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" `
    -WorkingDirectory $ProjectRoot
  $Trigger = New-ScheduledTaskTrigger -Daily -At $Time
  $Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Local Playwright Santa Fe auction check" `
    -Force | Out-Null
}

Register-SantaFeTask -TaskName "SantaFeAuctionCheck-Morning" -Time $Morning
Register-SantaFeTask -TaskName "SantaFeAuctionCheck-Evening" -Time $Evening

Write-Host "Installed Santa Fe local auction checks at $Morning and $Evening."
Write-Host "Manual run: powershell -ExecutionPolicy Bypass -File `"$Runner`""
