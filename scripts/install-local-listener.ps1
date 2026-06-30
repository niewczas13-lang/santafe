$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "run-local-listener.ps1"
$PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$TaskName = "SantaFeAuctionManualListener"
$ShortcutName = "SantaFeAuctionManualListener.lnk"

$Action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" `
  -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Days 7)

try {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Local listener for Santa Fe manual check requests from the Vercel dashboard" `
    -Force | Out-Null

  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Installed and started scheduled task $TaskName."
} catch {
  $Startup = [Environment]::GetFolderPath("Startup")
  $ShortcutPath = Join-Path $Startup $ShortcutName
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $PowerShell
  $Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`""
  $Shortcut.WorkingDirectory = $ProjectRoot
  $Shortcut.WindowStyle = 7
  $Shortcut.Description = "Local listener for Santa Fe manual check requests"
  $Shortcut.Save()

  Start-Process `
    -FilePath $PowerShell `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden

  Write-Host "Scheduled task install failed, so installed Startup shortcut instead:"
  Write-Host $ShortcutPath
  Write-Host "Listener started in the background for this session."
}

Write-Host "Manual run: powershell -ExecutionPolicy Bypass -File `"$Runner`""
