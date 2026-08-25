Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidad)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath
    Start-Process powershell.exe -ArgumentList $argumentos -Verb RunAs
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Security
[Windows.Forms.Application]::EnableVisualStyles()

$rutaConfig = Join-Path $PSScriptRoot "config.json"
$rutaEstado = Join-Path $PSScriptRoot "estado.json"
$directorioLogs = Join-Path $PSScriptRoot "logs"

$ventana = New-Object Windows.Forms.Form
$ventana.Text = "TaiLil ERP - Actualizador de red"
$ventana.StartPosition = "CenterScreen"
$ventana.Size = New-Object Drawing.Size(820, 800)
$ventana.MinimumSize = New-Object Drawing.Size(760, 730)
$ventana.BackColor = [Drawing.Color]::FromArgb(246, 248, 247)
$ventana.Font = New-Object Drawing.Font("Segoe UI", 10)

$titulo = New-Object Windows.Forms.Label
$titulo.Text = "TAiLiL ERP"
$titulo.Font = New-Object Drawing.Font("Segoe UI Semibold", 22)
$titulo.ForeColor = [Drawing.Color]::FromArgb(6, 75, 51)
$titulo.Location = New-Object Drawing.Point(28, 20)
$titulo.AutoSize = $true
$ventana.Controls.Add($titulo)

$subtitulo = New-Object Windows.Forms.Label
$subtitulo.Text = "Actualizacion segura y servicio para toda la red"
$subtitulo.ForeColor = [Drawing.Color]::FromArgb(83, 101, 93)
$subtitulo.Location = New-Object Drawing.Point(31, 61)
$subtitulo.AutoSize = $true
$ventana.Controls.Add($subtitulo)

$grupoConfig = New-Object Windows.Forms.GroupBox
$grupoConfig.Text = "Configuracion inicial"
$grupoConfig.Location = New-Object Drawing.Point(28, 95)
$grupoConfig.Size = New-Object Drawing.Size(745, 128)
$grupoConfig.Anchor = "Top,Left,Right"
$ventana.Controls.Add($grupoConfig)

$etiquetaRaiz = New-Object Windows.Forms.Label
$etiquetaRaiz.Text = "Directorio raiz del repositorio"
$etiquetaRaiz.Location = New-Object Drawing.Point(16, 27)
$etiquetaRaiz.AutoSize = $true
$grupoConfig.Controls.Add($etiquetaRaiz)

$campoRaiz = New-Object Windows.Forms.TextBox
$campoRaiz.Location = New-Object Drawing.Point(19, 51)
$campoRaiz.Size = New-Object Drawing.Size(590, 28)
$campoRaiz.Anchor = "Top,Left,Right"
$grupoConfig.Controls.Add($campoRaiz)

$examinar = New-Object Windows.Forms.Button
$examinar.Text = "Examinar..."
$examinar.Location = New-Object Drawing.Point(617, 49)
$examinar.Size = New-Object Drawing.Size(106, 31)
$examinar.Anchor = "Top,Right"
$grupoConfig.Controls.Add($examinar)

$etiquetaRama = New-Object Windows.Forms.Label
$etiquetaRama.Text = "Rama"
$etiquetaRama.Location = New-Object Drawing.Point(16, 91)
$etiquetaRama.AutoSize = $true
$grupoConfig.Controls.Add($etiquetaRama)

$campoRama = New-Object Windows.Forms.TextBox
$campoRama.Location = New-Object Drawing.Point(75, 87)
$campoRama.Size = New-Object Drawing.Size(180, 28)
$campoRama.Text = "main"
$grupoConfig.Controls.Add($campoRama)

$guardar = New-Object Windows.Forms.Button
$guardar.Text = "Guardar configuracion"
$guardar.Location = New-Object Drawing.Point(538, 86)
$guardar.Size = New-Object Drawing.Size(185, 31)
$guardar.Anchor = "Top,Right"
$guardar.BackColor = [Drawing.Color]::FromArgb(6, 75, 51)
$guardar.ForeColor = [Drawing.Color]::White
$guardar.FlatStyle = "Flat"
$grupoConfig.Controls.Add($guardar)

$panelBotones = New-Object Windows.Forms.FlowLayoutPanel
$panelBotones.Location = New-Object Drawing.Point(28, 240)
$panelBotones.Size = New-Object Drawing.Size(745, 88)
$panelBotones.Anchor = "Top,Left,Right"
$ventana.Controls.Add($panelBotones)

function Nuevo-Boton([string]$texto, [string]$operacion, [Drawing.Color]$color) {
    $boton = New-Object Windows.Forms.Button
    $boton.Text = $texto
    $boton.Tag = $operacion
    $boton.Size = New-Object Drawing.Size(135, 38)
    $boton.Margin = New-Object Windows.Forms.Padding(0, 0, 10, 0)
    $boton.BackColor = $color
    $boton.ForeColor = [Drawing.Color]::White
    $boton.FlatStyle = "Flat"
    $panelBotones.Controls.Add($boton)
    return $boton
}

$botonPreparar = Nuevo-Boton "Preparar nueva PC" "preparar" ([Drawing.Color]::FromArgb(25, 93, 125))
$botonPreparar.Size = New-Object Drawing.Size(165, 38)
$botonActualizar = Nuevo-Boton "Actualizar desde Git" "actualizar" ([Drawing.Color]::FromArgb(6, 75, 51))
$botonIniciar = Nuevo-Boton "Iniciar" "iniciar" ([Drawing.Color]::FromArgb(57, 115, 90))
$botonDetener = Nuevo-Boton "Detener" "detener" ([Drawing.Color]::FromArgb(154, 59, 59))
$botonReiniciar = Nuevo-Boton "Reiniciar" "reiniciar" ([Drawing.Color]::FromArgb(68, 88, 105))
$botonEstado = Nuevo-Boton "Comprobar" "estado" ([Drawing.Color]::FromArgb(90, 101, 96))
$botonQuitarServicio = Nuevo-Boton "Quitar servicio" "quitarservicio" ([Drawing.Color]::FromArgb(125, 53, 53))

$panelBackups = New-Object Windows.Forms.FlowLayoutPanel
$panelBackups.Location = New-Object Drawing.Point(28, 335)
$panelBackups.Size = New-Object Drawing.Size(745, 48)
$panelBackups.Anchor = "Top,Left,Right"
$ventana.Controls.Add($panelBackups)

function Nuevo-BotonBackup([string]$texto, [string]$operacion, [Drawing.Color]$color, [int]$ancho = 150) {
    $boton = New-Object Windows.Forms.Button
    $boton.Text = $texto; $boton.Tag = $operacion; $boton.Size = New-Object Drawing.Size($ancho, 38)
    $boton.Margin = New-Object Windows.Forms.Padding(0, 0, 10, 0); $boton.BackColor = $color; $boton.ForeColor = [Drawing.Color]::White; $boton.FlatStyle = "Flat"
    $panelBackups.Controls.Add($boton); return $boton
}

$botonBackup = Nuevo-BotonBackup "Crear backup" "backup" ([Drawing.Color]::FromArgb(67, 101, 142)) 135
$botonRestaurar = Nuevo-BotonBackup "Restaurar backup" "restaurar" ([Drawing.Color]::FromArgb(166, 104, 36)) 150
$botonProgramarBackup = Nuevo-BotonBackup "Programar diario" "programarbackup" ([Drawing.Color]::FromArgb(54, 122, 126)) 150
$botonQuitarBackup = Nuevo-BotonBackup "Quitar backup diario" "quitarbackupdiario" ([Drawing.Color]::FromArgb(112, 82, 82)) 165
$botonesOperacion = @($botonPreparar, $botonActualizar, $botonIniciar, $botonDetener, $botonReiniciar, $botonEstado, $botonQuitarServicio, $botonBackup, $botonRestaurar, $botonProgramarBackup, $botonQuitarBackup)

$etiquetaEstado = New-Object Windows.Forms.Label
$etiquetaEstado.Text = "Listo para configurar"
$etiquetaEstado.Font = New-Object Drawing.Font("Segoe UI Semibold", 11)
$etiquetaEstado.Location = New-Object Drawing.Point(31, 397)
$etiquetaEstado.Size = New-Object Drawing.Size(740, 26)
$etiquetaEstado.Anchor = "Top,Left,Right"
$ventana.Controls.Add($etiquetaEstado)

$progreso = New-Object Windows.Forms.ProgressBar
$progreso.Location = New-Object Drawing.Point(28, 427)
$progreso.Size = New-Object Drawing.Size(745, 10)
$progreso.Anchor = "Top,Left,Right"
$ventana.Controls.Add($progreso)

$registro = New-Object Windows.Forms.TextBox
$registro.Location = New-Object Drawing.Point(28, 455)
$registro.Size = New-Object Drawing.Size(745, 240)
$registro.Anchor = "Top,Bottom,Left,Right"
$registro.Multiline = $true
$registro.ReadOnly = $true
$registro.ScrollBars = "Vertical"
$registro.BackColor = [Drawing.Color]::White
$registro.Font = New-Object Drawing.Font("Consolas", 9)
$ventana.Controls.Add($registro)

$abrirSistema = New-Object Windows.Forms.LinkLabel
$abrirSistema.Text = "Abrir TaiLil ERP"
$abrirSistema.Location = New-Object Drawing.Point(31, 715)
$abrirSistema.AutoSize = $true
$abrirSistema.Anchor = "Bottom,Left"
$ventana.Controls.Add($abrirSistema)

$abrirLogs = New-Object Windows.Forms.LinkLabel
$abrirLogs.Text = "Abrir carpeta de registros"
$abrirLogs.Location = New-Object Drawing.Point(620, 715)
$abrirLogs.AutoSize = $true
$abrirLogs.Anchor = "Bottom,Right"
$ventana.Controls.Add($abrirLogs)

function Guardar-Configuracion([bool]$permitirNueva = $false) {
    $raiz = $campoRaiz.Text.Trim()
    $rama = $campoRama.Text.Trim()
    if (-not $raiz) { throw "Seleccione el directorio donde esta o se instalara TaiLil ERP." }
    if (-not $permitirNueva -and -not (Test-Path -LiteralPath $raiz -PathType Container)) { throw "Seleccione un directorio raiz existente." }
    if (-not $permitirNueva -and -not (Test-Path -LiteralPath (Join-Path $raiz ".git"))) { throw "El directorio seleccionado no contiene un repositorio Git." }
    if ($rama -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $rama.Contains("..")) { throw "El nombre de rama no es valido." }
    [ordered]@{ raizProyecto = [IO.Path]::GetFullPath($raiz); rama = $rama; remoto = "origin"; urlRepositorio = "https://github.com/MonteroFernando/TaiLil_ERP.git"; puertoWeb = 3000; puertoApi = 8000 } |
        ConvertTo-Json | Set-Content -LiteralPath $rutaConfig -Encoding UTF8
    $etiquetaEstado.Text = "Configuracion guardada. Ya puede actualizar o iniciar."
}

function Cargar-Configuracion {
    if (-not (Test-Path -LiteralPath $rutaConfig)) { return }
    try {
        $configuracion = Get-Content -LiteralPath $rutaConfig -Raw | ConvertFrom-Json
        $campoRaiz.Text = $configuracion.raizProyecto
        $campoRama.Text = $configuracion.rama
    } catch { }
}

function Pedir-PasswordBackup([bool]$confirmar) {
    $dialogo = New-Object Windows.Forms.Form
    $dialogo.Text = if ($confirmar) { "Proteger backup" } else { "Abrir backup" }
    $dialogo.StartPosition = "CenterParent"
    $dialogo.FormBorderStyle = "FixedDialog"
    $dialogo.MaximizeBox = $false; $dialogo.MinimizeBox = $false
    $dialogo.Size = New-Object Drawing.Size(440, $(if ($confirmar) { 235 } else { 180 }))
    $etiqueta = New-Object Windows.Forms.Label
    $etiqueta.Text = "Password del backup (minimo 10 caracteres)"
    $etiqueta.Location = New-Object Drawing.Point(18, 18); $etiqueta.AutoSize = $true; $dialogo.Controls.Add($etiqueta)
    $campo = New-Object Windows.Forms.TextBox
    $campo.Location = New-Object Drawing.Point(20, 45); $campo.Size = New-Object Drawing.Size(385, 28); $campo.UseSystemPasswordChar = $true; $dialogo.Controls.Add($campo)
    $campoConfirmar = $null
    if ($confirmar) {
        $etiqueta2 = New-Object Windows.Forms.Label
        $etiqueta2.Text = "Repita el password"; $etiqueta2.Location = New-Object Drawing.Point(18, 82); $etiqueta2.AutoSize = $true; $dialogo.Controls.Add($etiqueta2)
        $campoConfirmar = New-Object Windows.Forms.TextBox
        $campoConfirmar.Location = New-Object Drawing.Point(20, 106); $campoConfirmar.Size = New-Object Drawing.Size(385, 28); $campoConfirmar.UseSystemPasswordChar = $true; $dialogo.Controls.Add($campoConfirmar)
    }
    $aceptar = New-Object Windows.Forms.Button
    $aceptar.Text = "Aceptar"; $aceptar.Size = New-Object Drawing.Size(100, 32); $aceptar.Location = New-Object Drawing.Point(305, $(if ($confirmar) { 151 } else { 88 }))
    $aceptar.Add_Click({
        if ($campo.Text.Length -lt 10) { [Windows.Forms.MessageBox]::Show("El password debe tener al menos 10 caracteres.", "Backup", "OK", "Warning") | Out-Null; return }
        if ($confirmar -and $campo.Text -ne $campoConfirmar.Text) { [Windows.Forms.MessageBox]::Show("Los passwords no coinciden.", "Backup", "OK", "Warning") | Out-Null; return }
        $dialogo.Tag = $campo.Text; $dialogo.DialogResult = "OK"; $dialogo.Close()
    })
    $dialogo.Controls.Add($aceptar); $dialogo.AcceptButton = $aceptar
    if ($dialogo.ShowDialog($ventana) -ne "OK") { return $null }
    return [string]$dialogo.Tag
}

function Guardar-SolicitudBackup([string]$ruta, [string]$password) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($password)
    $protegido = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [ordered]@{ ruta = $ruta; passwordProtegido = [Convert]::ToBase64String($protegido) } | ConvertTo-Json |
        Set-Content -LiteralPath (Join-Path $PSScriptRoot "solicitud-operacion.json") -Encoding UTF8
}

function Configurar-BackupDiario {
    $dialogo = New-Object Windows.Forms.Form
    $dialogo.Text = "Programar backup diario"; $dialogo.StartPosition = "CenterParent"; $dialogo.FormBorderStyle = "FixedDialog"
    $dialogo.MaximizeBox = $false; $dialogo.MinimizeBox = $false; $dialogo.Size = New-Object Drawing.Size(560, 420)
    $configAnterior = $null; $rutaConfigBackup = Join-Path $PSScriptRoot "backup-diario.json"
    if (Test-Path -LiteralPath $rutaConfigBackup) { try { $configAnterior = Get-Content -LiteralPath $rutaConfigBackup -Raw | ConvertFrom-Json } catch { } }
    $directorioInicial = if ($configAnterior) { $configAnterior.directorio } elseif ($campoRaiz.Text) { Join-Path $campoRaiz.Text "logs\backups-diarios" } else { "C:\TaiLilERP-Backups" }

    $etiquetaCarpeta = New-Object Windows.Forms.Label
    $etiquetaCarpeta.Text = "Carpeta de destino"; $etiquetaCarpeta.Location = New-Object Drawing.Point(18, 20); $etiquetaCarpeta.AutoSize = $true; $dialogo.Controls.Add($etiquetaCarpeta)
    $campoCarpeta = New-Object Windows.Forms.TextBox
    $campoCarpeta.Text = $directorioInicial; $campoCarpeta.Location = New-Object Drawing.Point(20, 45); $campoCarpeta.Size = New-Object Drawing.Size(390, 28); $dialogo.Controls.Add($campoCarpeta)
    $buscarCarpeta = New-Object Windows.Forms.Button
    $buscarCarpeta.Text = "Examinar"; $buscarCarpeta.Location = New-Object Drawing.Point(418, 43); $buscarCarpeta.Size = New-Object Drawing.Size(100, 31); $dialogo.Controls.Add($buscarCarpeta)
    $buscarCarpeta.Add_Click({ $selector = New-Object Windows.Forms.FolderBrowserDialog; if (Test-Path -LiteralPath $campoCarpeta.Text) { $selector.SelectedPath = $campoCarpeta.Text }; if ($selector.ShowDialog($dialogo) -eq "OK") { $campoCarpeta.Text = $selector.SelectedPath } })

    $etiquetaHora = New-Object Windows.Forms.Label
    $etiquetaHora.Text = "Hora diaria"; $etiquetaHora.Location = New-Object Drawing.Point(18, 91); $etiquetaHora.AutoSize = $true; $dialogo.Controls.Add($etiquetaHora)
    $campoHora = New-Object Windows.Forms.DateTimePicker
    $campoHora.Format = "Custom"; $campoHora.CustomFormat = "HH:mm"; $campoHora.ShowUpDown = $true; $campoHora.Location = New-Object Drawing.Point(20, 116); $campoHora.Size = New-Object Drawing.Size(120, 28)
    $horaInicial = if ($configAnterior) { $configAnterior.hora } else { "02:00" }; $campoHora.Value = [DateTime]::Today.Add([TimeSpan]::Parse($horaInicial)); $dialogo.Controls.Add($campoHora)
    $etiquetaRetencion = New-Object Windows.Forms.Label
    $etiquetaRetencion.Text = "Cantidad de copias a conservar"; $etiquetaRetencion.Location = New-Object Drawing.Point(175, 91); $etiquetaRetencion.AutoSize = $true; $dialogo.Controls.Add($etiquetaRetencion)
    $campoRetencion = New-Object Windows.Forms.NumericUpDown
    $campoRetencion.Minimum = 2; $campoRetencion.Maximum = 365; $campoRetencion.Value = if ($configAnterior) { [decimal]$configAnterior.retencion } else { 30 }; $campoRetencion.Location = New-Object Drawing.Point(178, 116); $campoRetencion.Size = New-Object Drawing.Size(110, 28); $dialogo.Controls.Add($campoRetencion)

    $etiquetaPassword = New-Object Windows.Forms.Label
    $etiquetaPassword.Text = "Password para cifrar las copias"; $etiquetaPassword.Location = New-Object Drawing.Point(18, 164); $etiquetaPassword.AutoSize = $true; $dialogo.Controls.Add($etiquetaPassword)
    $campoPassword = New-Object Windows.Forms.TextBox
    $campoPassword.Location = New-Object Drawing.Point(20, 189); $campoPassword.Size = New-Object Drawing.Size(498, 28); $campoPassword.UseSystemPasswordChar = $true; $dialogo.Controls.Add($campoPassword)
    $etiquetaConfirmar = New-Object Windows.Forms.Label
    $etiquetaConfirmar.Text = "Repita el password"; $etiquetaConfirmar.Location = New-Object Drawing.Point(18, 231); $etiquetaConfirmar.AutoSize = $true; $dialogo.Controls.Add($etiquetaConfirmar)
    $campoConfirmar = New-Object Windows.Forms.TextBox
    $campoConfirmar.Location = New-Object Drawing.Point(20, 256); $campoConfirmar.Size = New-Object Drawing.Size(498, 28); $campoConfirmar.UseSystemPasswordChar = $true; $dialogo.Controls.Add($campoConfirmar)
    $nota = New-Object Windows.Forms.Label
    $nota.Text = "El password queda protegido por Windows y debe conservarlo para restaurar en otra PC."; $nota.Location = New-Object Drawing.Point(18, 296); $nota.Size = New-Object Drawing.Size(500, 38); $nota.ForeColor = [Drawing.Color]::FromArgb(83, 101, 93); $dialogo.Controls.Add($nota)
    $aceptar = New-Object Windows.Forms.Button
    $aceptar.Text = "Programar"; $aceptar.Location = New-Object Drawing.Point(408, 336); $aceptar.Size = New-Object Drawing.Size(110, 32)
    $aceptar.Add_Click({
        if (-not $campoCarpeta.Text.Trim()) { [Windows.Forms.MessageBox]::Show("Seleccione una carpeta.", "Backup diario", "OK", "Warning") | Out-Null; return }
        if ($campoPassword.Text.Length -lt 10) { [Windows.Forms.MessageBox]::Show("El password debe tener al menos 10 caracteres.", "Backup diario", "OK", "Warning") | Out-Null; return }
        if ($campoPassword.Text -ne $campoConfirmar.Text) { [Windows.Forms.MessageBox]::Show("Los passwords no coinciden.", "Backup diario", "OK", "Warning") | Out-Null; return }
        $dialogo.Tag = [pscustomobject]@{ directorio = $campoCarpeta.Text.Trim(); hora = $campoHora.Value.ToString("HH:mm"); retencion = [int]$campoRetencion.Value; password = $campoPassword.Text }
        $dialogo.DialogResult = "OK"; $dialogo.Close()
    })
    $dialogo.Controls.Add($aceptar); $dialogo.AcceptButton = $aceptar
    if ($dialogo.ShowDialog($ventana) -ne "OK") { return $false }
    $datos = $dialogo.Tag; $bytes = [Text.Encoding]::UTF8.GetBytes($datos.password)
    $protegido = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    [ordered]@{ directorio = $datos.directorio; hora = $datos.hora; retencion = $datos.retencion; passwordProtegido = [Convert]::ToBase64String($protegido) } |
        ConvertTo-Json | Set-Content -LiteralPath $rutaConfigBackup -Encoding UTF8
    return $true
}

function Iniciar-Operacion([string]$operacion) {
    try { Guardar-Configuracion ($operacion -eq "preparar") } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuracion", "OK", "Warning") | Out-Null; return }
    foreach ($boton in $botonesOperacion) { $boton.Enabled = $false }
    $guardar.Enabled = $false
    $progreso.Value = 1
    $etiquetaEstado.Text = "Iniciando $operacion..."
    [ordered]@{ ocupado = $true; error = $false; etapa = "PREPARANDO"; mensaje = "Iniciando $operacion..."; progreso = 1; fecha = (Get-Date).ToString("o") } |
        ConvertTo-Json | Set-Content -LiteralPath $rutaEstado -Encoding UTF8
    $worker = Join-Path $PSScriptRoot "Ejecutar-Operacion.ps1"
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Operacion {1} -Silencioso' -f $worker, $operacion
    Start-Process powershell.exe -ArgumentList $argumentos -WindowStyle Hidden | Out-Null
}

$examinar.Add_Click({
    $selector = New-Object Windows.Forms.FolderBrowserDialog
    $selector.Description = "Seleccione la raiz del repositorio TaiLil ERP"
    if ($campoRaiz.Text -and (Test-Path -LiteralPath $campoRaiz.Text)) { $selector.SelectedPath = $campoRaiz.Text }
    if ($selector.ShowDialog() -eq "OK") { $campoRaiz.Text = $selector.SelectedPath }
})
$guardar.Add_Click({ try { Guardar-Configuracion } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuracion", "OK", "Warning") | Out-Null } })
foreach ($boton in $botonesOperacion) {
    $boton.Add_Click({
        param($sender, $evento)
        if ($sender.Tag -eq "backup") {
            try { Guardar-Configuracion } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuracion", "OK", "Warning") | Out-Null; return }
            $selector = New-Object Windows.Forms.SaveFileDialog
            $selector.Filter = "Backup TaiLil ERP (*.taililbackup)|*.taililbackup"
            $selector.DefaultExt = "taililbackup"; $selector.AddExtension = $true; $selector.FileName = "TaiLilERP-$(Get-Date -Format 'yyyyMMdd-HHmm').taililbackup"
            if ($selector.ShowDialog($ventana) -ne "OK") { return }
            $password = Pedir-PasswordBackup $true; if (-not $password) { return }
            Guardar-SolicitudBackup $selector.FileName $password
            Iniciar-Operacion "backup"; return
        }
        if ($sender.Tag -eq "restaurar") {
            try { Guardar-Configuracion } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuracion", "OK", "Warning") | Out-Null; return }
            $selector = New-Object Windows.Forms.OpenFileDialog
            $selector.Filter = "Backup TaiLil ERP (*.taililbackup)|*.taililbackup"; $selector.CheckFileExists = $true
            if ($selector.ShowDialog($ventana) -ne "OK") { return }
            $password = Pedir-PasswordBackup $false; if (-not $password) { return }
            $confirmacion = [Windows.Forms.MessageBox]::Show("La base actual sera reemplazada por el backup seleccionado.`n`nAntes se creara un respaldo preventivo. Desea continuar?", "Restaurar backup", "YesNo", "Warning")
            if ($confirmacion -ne "Yes") { return }
            Guardar-SolicitudBackup $selector.FileName $password
            Iniciar-Operacion "restaurar"; return
        }
        if ($sender.Tag -eq "programarbackup") {
            try { Guardar-Configuracion } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuracion", "OK", "Warning") | Out-Null; return }
            if (Configurar-BackupDiario) { Iniciar-Operacion "programarbackup" }
            return
        }
        if ($sender.Tag -eq "quitarbackupdiario") {
            $confirmacion = [Windows.Forms.MessageBox]::Show("Se eliminara la tarea diaria, pero se conservaran todos los backups ya creados. Desea continuar?", "Quitar backup diario", "YesNo", "Warning")
            if ($confirmacion -ne "Yes") { return }
            Iniciar-Operacion "quitarbackupdiario"; return
        }
        if ($sender.Tag -eq "quitarservicio") {
            $confirmacion = [Windows.Forms.MessageBox]::Show("Se detendra TaiLil ERP y se quitara su inicio automatico y la regla de firewall.`n`nEl proyecto y la base de datos se conservaran. Desea continuar?", "Quitar servicio TaiLil ERP", "YesNo", "Warning")
            if ($confirmacion -ne "Yes") { return }
        }
        Iniciar-Operacion "$($sender.Tag)"
    })
}
$abrirSistema.Add_LinkClicked({ Start-Process "http://localhost:3000" })
$abrirLogs.Add_LinkClicked({ New-Item -ItemType Directory -Path $directorioLogs -Force | Out-Null; Start-Process explorer.exe -ArgumentList $directorioLogs })

$temporizador = New-Object Windows.Forms.Timer
$temporizador.Interval = 1000
$temporizador.Add_Tick({
    if (Test-Path -LiteralPath $rutaEstado) {
        try {
            $estado = Get-Content -LiteralPath $rutaEstado -Raw | ConvertFrom-Json
            $etiquetaEstado.Text = "$($estado.etapa): $($estado.mensaje)"
            $progreso.Value = [Math]::Max(0, [Math]::Min(100, [int]$estado.progreso))
            foreach ($boton in $botonesOperacion) { $boton.Enabled = -not [bool]$estado.ocupado }
            $guardar.Enabled = -not [bool]$estado.ocupado
            if (-not $estado.ocupado -and $estado.error) { $etiquetaEstado.ForeColor = [Drawing.Color]::FromArgb(170, 35, 35) }
            elseif (-not $estado.ocupado) { $etiquetaEstado.ForeColor = [Drawing.Color]::FromArgb(6, 75, 51) }
            else { $etiquetaEstado.ForeColor = [Drawing.Color]::FromArgb(45, 58, 52) }
        } catch { }
    }
    $logHoy = Join-Path $directorioLogs ("actualizador-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
    if (Test-Path -LiteralPath $logHoy) {
        try {
            $lineas = @(Get-Content -LiteralPath $logHoy -Tail 120)
            $texto = $lineas -join [Environment]::NewLine
            if ($registro.Text -ne $texto) { $registro.Text = $texto; $registro.SelectionStart = $registro.TextLength; $registro.ScrollToCaret() }
        } catch { }
    }
})

Cargar-Configuracion
$temporizador.Start()
[void]$ventana.ShowDialog()
$temporizador.Stop()
