param(
  [string]$Source = "all"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot ".local-logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "check-$Timestamp.log"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
Set-Location $ProjectRoot

"[$(Get-Date -Format o)] Starting local Santa Fe auction check (source=$Source)" |
  Tee-Object -FilePath $LogFile

& npm.cmd run check:local -- --source=$Source 2>&1 |
  Tee-Object -FilePath $LogFile -Append

$ExitCode = $LASTEXITCODE
"[$(Get-Date -Format o)] Finished with exit code $ExitCode" |
  Tee-Object -FilePath $LogFile -Append

exit $ExitCode
