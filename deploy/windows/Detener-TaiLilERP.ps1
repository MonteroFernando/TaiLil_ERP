param(
    [string]$RaizProyecto = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$directorioLogs = Join-Path $RaizProyecto "logs"
foreach ($nombre in @("web", "api")) {
    $archivoPid = Join-Path $directorioLogs "$nombre.pid"
    if (Test-Path -LiteralPath $archivoPid) {
        $idProceso = [int](Get-Content -LiteralPath $archivoPid)
        Stop-Process -Id $idProceso -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $archivoPid -ErrorAction SilentlyContinue
    }
}

Write-Output "Procesos de TaiLil ERP detenidos."
