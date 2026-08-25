Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidad)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath
    Start-Process powershell.exe -ArgumentList $argumentos -Verb RunAs
    exit
}

$destino = Join-Path $env:ProgramData "TaiLilERP\Actualizador"
New-Item -ItemType Directory -Path $destino -Force | Out-Null
foreach ($archivo in @("TaiLilUpdater.Core.psm1", "TaiLil-Actualizador.ps1", "Ejecutar-Operacion.ps1", "Abrir-Actualizador.cmd", "Instalar-Actualizador.cmd", "Instalar-Actualizador.ps1", "README.md")) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $archivo) -Destination (Join-Path $destino $archivo) -Force
}

$shell = New-Object -ComObject WScript.Shell
$escritorio = [Environment]::GetFolderPath("CommonDesktopDirectory")
$acceso = $shell.CreateShortcut((Join-Path $escritorio "TaiLil ERP - Actualizador.lnk"))
$acceso.TargetPath = Join-Path $destino "Abrir-Actualizador.cmd"
$acceso.WorkingDirectory = $destino
$acceso.Description = "Actualizar y administrar TaiLil ERP"
$acceso.Save()

[Windows.Forms.MessageBox]::Show("Actualizador instalado en:`n$destino`n`nSe creo un acceso directo en el escritorio.", "TaiLil ERP", "OK", "Information") | Out-Null
Start-Process (Join-Path $destino "Abrir-Actualizador.cmd")
