param(
    [string]$Url = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$candidatosEdge = @(
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
)
$edge = $candidatosEdge | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) {
    $comandoEdge = Get-Command "msedge.exe" -ErrorAction SilentlyContinue
    $edge = $comandoEdge.Source
}
if (-not $edge) {
    throw "No se encontro Microsoft Edge en este equipo."
}

Start-Process `
    -FilePath $edge `
    -ArgumentList "--app=$Url", "--kiosk-printing", "--start-maximized", "--no-first-run"

Write-Output "TaiLil ERP POS abierto con impresion directa habilitada: $Url"
