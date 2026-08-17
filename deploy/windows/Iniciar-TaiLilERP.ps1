param(
    [string]$RaizProyecto = (Resolve-Path (Join-Path $PSScriptRoot "..\..")),
    [int]$PuertoWeb = 3000,
    [int]$PuertoApi = 8000
)

$ErrorActionPreference = "Stop"
$directorioLogs = Join-Path $RaizProyecto "logs"
$python = Join-Path $RaizProyecto ".venv\Scripts\python.exe"
$directorioWeb = Join-Path $RaizProyecto "apps\web"
$buildWeb = Join-Path $directorioWeb ".next\BUILD_ID"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $python)) {
    throw "No se encontro el entorno virtual: $python"
}
if (-not (Test-Path -LiteralPath (Join-Path $RaizProyecto ".env"))) {
    throw "No se encontro el archivo .env en $RaizProyecto"
}
if (-not (Test-Path -LiteralPath $buildWeb)) {
    throw "No existe el build del frontend. Ejecute npm ci y npm run build en apps\web."
}

New-Item -ItemType Directory -Path $directorioLogs -Force | Out-Null

function Puerto-En-Uso([int]$Puerto) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction SilentlyContinue)
}

if (-not (Puerto-En-Uso $PuertoApi)) {
    $procesoApi = Start-Process `
        -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$PuertoApi", "--app-dir", "apps/api" `
        -WorkingDirectory $RaizProyecto `
        -RedirectStandardOutput (Join-Path $directorioLogs "api.log") `
        -RedirectStandardError (Join-Path $directorioLogs "api-error.log") `
        -WindowStyle Hidden `
        -PassThru
    Set-Content -LiteralPath (Join-Path $directorioLogs "api.pid") -Value $procesoApi.Id
}

if (-not (Puerto-En-Uso $PuertoWeb)) {
    $procesoWeb = Start-Process `
        -FilePath $npm `
        -ArgumentList "run", "start", "--", "--hostname", "0.0.0.0", "--port", "$PuertoWeb" `
        -WorkingDirectory $directorioWeb `
        -RedirectStandardOutput (Join-Path $directorioLogs "web.log") `
        -RedirectStandardError (Join-Path $directorioLogs "web-error.log") `
        -WindowStyle Hidden `
        -PassThru
    Set-Content -LiteralPath (Join-Path $directorioLogs "web.pid") -Value $procesoWeb.Id
}

Start-Sleep -Seconds 3
$apiActiva = Puerto-En-Uso $PuertoApi
$webActiva = Puerto-En-Uso $PuertoWeb

if (-not $apiActiva -or -not $webActiva) {
    throw "El inicio no se completo. Revise los archivos de la carpeta logs. API=$apiActiva WEB=$webActiva"
}

try {
    Invoke-WebRequest "http://127.0.0.1:$PuertoApi/api/v1/sistema/estado" -UseBasicParsing -TimeoutSec 10 | Out-Null
    Invoke-WebRequest "http://127.0.0.1:$PuertoWeb/api/v1/sistema/estado" -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
    throw "Los puertos abrieron, pero la verificacion HTTP fallo. Revise logs\api-error.log y logs\web-error.log. $($_.Exception.Message)"
}

Write-Output "TaiLil ERP iniciado. WEB 0.0.0.0:$PuertoWeb; API interna 127.0.0.1:$PuertoApi"
