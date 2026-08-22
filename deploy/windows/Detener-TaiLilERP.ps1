param(
    [string]$RaizProyecto = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$directorioLogs = Join-Path $RaizProyecto "logs"

function Detener-ArbolProceso([int]$IdProceso) {
    $hijos = Get-CimInstance Win32_Process -Filter "ParentProcessId=$IdProceso" -ErrorAction SilentlyContinue
    foreach ($hijo in $hijos) {
        Detener-ArbolProceso -IdProceso $hijo.ProcessId
    }
    Stop-Process -Id $IdProceso -Force -ErrorAction SilentlyContinue
}

foreach ($nombre in @("web", "api")) {
    $archivoPid = Join-Path $directorioLogs "$nombre.pid"
    if (Test-Path -LiteralPath $archivoPid) {
        $idProceso = [int](Get-Content -LiteralPath $archivoPid)
        Detener-ArbolProceso -IdProceso $idProceso
        Remove-Item -LiteralPath $archivoPid -ErrorAction SilentlyContinue
    }
}

# Un servidor iniciado anteriormente con recarga puede dejar un hijo escuchando
# aunque el PID padre ya no exista. Solo se detienen procesos de los puertos del
# ERP cuya linea de comando pertenece expresamente a este proyecto.
$raizNormalizada = [IO.Path]::GetFullPath($RaizProyecto)
foreach ($puerto in @(8000, 3000)) {
    $conexiones = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue
    foreach ($conexion in $conexiones) {
        $proceso = Get-CimInstance Win32_Process -Filter "ProcessId=$($conexion.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proceso -and $proceso.CommandLine -like "*$raizNormalizada*") {
            Detener-ArbolProceso -IdProceso $proceso.ProcessId
        }
    }
}

Write-Output "Procesos de TaiLil ERP detenidos."
