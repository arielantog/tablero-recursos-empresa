$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $scriptDir 'iniciar-aplicacion.ps1'

if (-not (Test-Path $launcherPath)) {
  Write-Error "No encontré el lanzador principal en $launcherPath"
  exit 1
}

& $launcherPath
