$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot ".local-logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "listener-$Timestamp.log"
$Tsx = Join-Path $ProjectRoot "node_modules\.bin\tsx.cmd"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
Set-Location $ProjectRoot

"[$(Get-Date -Format o)] Starting local Santa Fe manual check listener" |
  Tee-Object -FilePath $LogFile

& $Tsx "scripts/listen-local-checks.ts" 2>&1 |
  Tee-Object -FilePath $LogFile -Append

$ExitCode = $LASTEXITCODE
"[$(Get-Date -Format o)] Listener exited with code $ExitCode" |
  Tee-Object -FilePath $LogFile -Append

exit $ExitCode
