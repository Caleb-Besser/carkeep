param(
  [string]$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$Url = "http://localhost:3000"
)

function Test-AppReady {
  param([string]$TargetUrl)

  try {
    Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

$resolvedAppDir = (Resolve-Path $AppDir).Path

if (-not (Test-AppReady -TargetUrl $Url)) {
  $escapedAppDir = $resolvedAppDir.Replace("'", "''")
  $launchCommand = "Set-Location -LiteralPath '$escapedAppDir'; npm run dev"

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $launchCommand
  ) | Out-Null

  $deadline = (Get-Date).AddSeconds(60)

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 750

    if (Test-AppReady -TargetUrl $Url) {
      break
    }
  }
}

Start-Process $Url
