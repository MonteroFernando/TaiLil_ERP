param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("preparar", "actualizar", "iniciar", "arranque", "detener", "reiniciar", "estado", "quitarservicio", "backup", "restaurar", "programarbackup", "quitarbackupdiario", "backupautomatico")]
    [string]$Operacion,
    [switch]$Silencioso
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
Import-Module (Join-Path $PSScriptRoot "TaiLilUpdater.Core.psm1") -Force

$lock = Join-Path $PSScriptRoot "operacion.lock"
$rutaSolicitud = Join-Path $PSScriptRoot "solicitud-operacion.json"
$configuracion = $null
$poseeLock = $false
$eliminarSolicitud = $false
try {
    if (Test-Path -LiteralPath $lock) {
        $pidAnterior = 0
        [int]::TryParse((Get-Content -LiteralPath $lock -Raw), [ref]$pidAnterior) | Out-Null
        if ($pidAnterior -and (Get-Process -Id $pidAnterior -ErrorAction SilentlyContinue)) {
            throw "Ya existe una operacion en curso."
        }
        Remove-Item -LiteralPath $lock -Force
    }
    Set-Content -LiteralPath $lock -Value $PID -Encoding ASCII
    $poseeLock = $true
    $configuracion = Get-ConfiguracionActualizador -DirectorioActualizador $PSScriptRoot
    if ($Operacion -notin @("preparar", "quitarservicio", "quitarbackupdiario")) { Assert-ProyectoValido -Configuracion $configuracion }
    Set-EstadoActualizador $PSScriptRoot "PREPARANDO" "Preparando $Operacion..." 1 $true $false
    Write-Registro $PSScriptRoot ("Operacion solicitada: {0}" -f $Operacion.ToUpperInvariant()) | Out-Null

    $resultado = ""
    $solicitud = $null
    if ($Operacion -in @("backup", "restaurar")) {
        $eliminarSolicitud = $true
        if (-not (Test-Path -LiteralPath $rutaSolicitud)) { throw "Faltan los datos de la operacion de backup." }
        $datosSolicitud = Get-Content -LiteralPath $rutaSolicitud -Raw | ConvertFrom-Json
        $protegido = [Convert]::FromBase64String($datosSolicitud.passwordProtegido)
        $bytesPassword = [Security.Cryptography.ProtectedData]::Unprotect($protegido, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $solicitud = [pscustomobject]@{ ruta = $datosSolicitud.ruta; password = [Text.Encoding]::UTF8.GetString($bytesPassword) }
    }
    switch ($Operacion) {
        "preparar" { $resultado = Initialize-NuevaPC $configuracion $PSScriptRoot }
        "actualizar" { $resultado = Update-TaiLil $configuracion $PSScriptRoot }
        "iniciar" {
            Install-IntegracionWindows $configuracion $PSScriptRoot
            Start-TaiLil $configuracion $PSScriptRoot
            Test-SaludTaiLil $configuracion $PSScriptRoot
            $resultado = "Servicio instalado, iniciado y verificado."
        }
        "arranque" {
            Start-TaiLil $configuracion $PSScriptRoot
            Test-SaludTaiLil $configuracion $PSScriptRoot
            $resultado = "Servicios iniciados y verificados."
        }
        "detener" {
            Stop-TaiLil $configuracion $PSScriptRoot
            $resultado = "Servicios detenidos."
        }
        "reiniciar" {
            Stop-TaiLil $configuracion $PSScriptRoot
            Start-TaiLil $configuracion $PSScriptRoot
            Test-SaludTaiLil $configuracion $PSScriptRoot
            $resultado = "Servicios reiniciados y verificados."
        }
        "estado" {
            Test-SaludTaiLil $configuracion $PSScriptRoot
            $resultado = "Frontend y backend responden correctamente."
        }
        "quitarservicio" { $resultado = Remove-IntegracionWindows $configuracion $PSScriptRoot }
        "backup" { $resultado = Export-BackupTransportable $configuracion $PSScriptRoot $solicitud.ruta $solicitud.password }
        "restaurar" { $resultado = Import-BackupTransportable $configuracion $PSScriptRoot $solicitud.ruta $solicitud.password }
        "programarbackup" { $resultado = Install-BackupDiario $configuracion $PSScriptRoot }
        "quitarbackupdiario" { $resultado = Remove-BackupDiario $PSScriptRoot }
        "backupautomatico" { $resultado = Invoke-BackupDiario $configuracion $PSScriptRoot }
    }
    if ($Operacion -notin @("detener", "quitarservicio", "programarbackup", "quitarbackupdiario", "backupautomatico", "backup")) {
        $direcciones = @(Get-DireccionesTaiLil $configuracion)
        if ($direcciones.Count) { $resultado = "$resultado Direcciones: $($direcciones -join ' | ')" }
    }
    Write-Registro $PSScriptRoot $resultado | Out-Null
    Set-EstadoActualizador $PSScriptRoot "COMPLETADO" $resultado 100 $false $false
    if (-not $Silencioso) { Write-Output $resultado }
    exit 0
}
catch {
    $detalle = $_.Exception.Message
    try { Write-Registro $PSScriptRoot "ERROR: $detalle" | Out-Null } catch { }
    if ($null -ne $configuracion -and $Operacion -in @("actualizar", "reiniciar") -and (Test-Path -LiteralPath (Join-Path $configuracion.raizProyecto "apps\web\.next\BUILD_ID"))) {
        try {
            Write-Registro $PSScriptRoot "Intentando recuperar el servicio con el build disponible..." | Out-Null
            Start-TaiLil $configuracion $PSScriptRoot
            Test-SaludTaiLil $configuracion $PSScriptRoot
            $detalle = "$detalle El servicio pudo volver a iniciarse; revise el registro antes de reintentar."
        }
        catch {
            Write-Registro $PSScriptRoot "La recuperacion automatica tampoco pudo iniciar el servicio: $($_.Exception.Message)" | Out-Null
        }
    }
    try { Set-EstadoActualizador $PSScriptRoot "ERROR" $detalle 100 $false $true } catch { }
    if (-not $Silencioso) { Write-Error $detalle }
    exit 1
}
finally {
    if ($eliminarSolicitud) { Remove-Item -LiteralPath $rutaSolicitud -Force -ErrorAction SilentlyContinue }
    if ($poseeLock) { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue }
}
