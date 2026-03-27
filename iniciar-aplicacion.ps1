$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$envFile = Join-Path $backendDir '.env'
$serverFile = Join-Path $backendDir 'server.js'
$packageJson = Join-Path $backendDir 'package.json'
$nodeModulesDir = Join-Path $backendDir 'node_modules'

if (-not (Test-Path $backendDir)) {
  Write-Error "No existe la carpeta backend en $projectRoot"
  exit 1
}

if (-not (Test-Path $serverFile)) {
  Write-Error "No encontré el archivo del servidor en $serverFile"
  exit 1
}

if (-not (Test-Path $packageJson)) {
  Write-Error "No encontré package.json en $backendDir"
  exit 1
}

if (-not (Test-Path $nodeModulesDir)) {
  Write-Error "Faltan dependencias. Ejecuta 'npm install' dentro de $backendDir"
  exit 1
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Error "Node.js no está disponible en PATH"
  exit 1
}

$port = 3000

if (Test-Path $envFile) {
  $portLine = Get-Content $envFile |
    Where-Object { $_ -match '^\s*PORT\s*=' } |
    Select-Object -First 1

  if ($portLine) {
    $parsedPort = ($portLine -split '=', 2)[1].Trim()
    if ($parsedPort -match '^\d+$') {
      $port = [int]$parsedPort
    }
  }
}

$url = "http://localhost:$port"
$healthUrl = "$url/api/health"

$existingProcess = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty OwningProcess

if (-not $existingProcess) {
  Start-Process -FilePath $nodeCommand.Source -ArgumentList 'server.js' -WorkingDirectory $backendDir | Out-Null

  $started = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500

    try {
      $response = Invoke-WebRequest -UseBasicParsing $healthUrl
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        $started = $true
        break
      }
    } catch {
    }
  }

  if (-not $started) {
    Write-Error "No pude iniciar el servidor en $url"
    exit 1
  }
}

Start-Process $url
Write-Host "Aplicación disponible en $url"
