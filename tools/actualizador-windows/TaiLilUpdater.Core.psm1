Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$script:NombreTarea = "TaiLil ERP - Inicio automatico"
$script:NombreTareaBackup = "TaiLil ERP - Backup diario"
$script:NombreFirewall = "TaiLil ERP Web"

function Get-RutaEstado {
    param([Parameter(Mandatory = $true)][string]$DirectorioActualizador)
    return Join-Path $DirectorioActualizador "estado.json"
}

function Get-RutaLog {
    param([Parameter(Mandatory = $true)][string]$DirectorioActualizador)
    $directorio = Join-Path $DirectorioActualizador "logs"
    New-Item -ItemType Directory -Path $directorio -Force | Out-Null
    return Join-Path $directorio ("actualizador-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
}

function Write-Registro {
    param(
        [Parameter(Mandatory = $true)][string]$DirectorioActualizador,
        [Parameter(Mandatory = $true)][string]$Mensaje
    )
    $linea = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Mensaje
    Add-Content -LiteralPath (Get-RutaLog -DirectorioActualizador $DirectorioActualizador) -Value $linea -Encoding UTF8
    Write-Output $linea
}

function Set-EstadoActualizador {
    param(
        [Parameter(Mandatory = $true)][string]$DirectorioActualizador,
        [Parameter(Mandatory = $true)][string]$Etapa,
        [Parameter(Mandatory = $true)][string]$Mensaje,
        [int]$Progreso = 0,
        [bool]$Ocupado = $true,
        [bool]$EsError = $false
    )
    $estado = [ordered]@{
        ocupado = $Ocupado
        error = $EsError
        etapa = $Etapa
        mensaje = $Mensaje
        progreso = [Math]::Max(0, [Math]::Min(100, $Progreso))
        fecha = (Get-Date).ToString("o")
    }
    $estado | ConvertTo-Json | Set-Content -LiteralPath (Get-RutaEstado -DirectorioActualizador $DirectorioActualizador) -Encoding UTF8
}

function Invoke-Programa {
    param(
        [Parameter(Mandatory = $true)][string]$Programa,
        [string[]]$Argumentos = @(),
        [Parameter(Mandatory = $true)][string]$DirectorioActualizador,
        [string]$DirectorioTrabajo = "",
        [int[]]$CodigosPermitidos = @(0),
        [switch]$OcultarArgumentos
    )
    $anterior = Get-Location
    try {
        if ($DirectorioTrabajo) { Set-Location -LiteralPath $DirectorioTrabajo }
        $argumentosRegistro = if ($OcultarArgumentos) { "[argumentos protegidos]" } else { $Argumentos -join " " }
        Write-Registro -DirectorioActualizador $DirectorioActualizador -Mensaje ("Ejecutando: {0} {1}" -f (Split-Path $Programa -Leaf), $argumentosRegistro) | Out-Null
        $salida = @(& $Programa @Argumentos 2>&1)
        $codigo = $LASTEXITCODE
        foreach ($linea in $salida) {
            if ($null -ne $linea -and "$linea".Trim()) {
                Write-Registro -DirectorioActualizador $DirectorioActualizador -Mensaje "$linea" | Out-Null
            }
        }
        if ($CodigosPermitidos -notcontains $codigo) {
            throw "El programa termino con codigo $codigo`: $(Split-Path $Programa -Leaf)"
        }
        return [pscustomobject]@{ Codigo = $codigo; Salida = (($salida | ForEach-Object { "$_" }) -join "`n").Trim() }
    }
    finally {
        Set-Location -LiteralPath $anterior
    }
}

function Get-ConfiguracionActualizador {
    param([Parameter(Mandatory = $true)][string]$DirectorioActualizador)
    $ruta = Join-Path $DirectorioActualizador "config.json"
    if (-not (Test-Path -LiteralPath $ruta)) { throw "Falta configurar el actualizador." }
    $configuracion = Get-Content -LiteralPath $ruta -Raw | ConvertFrom-Json
    if (-not $configuracion.raizProyecto -or -not $configuracion.rama) { throw "La raiz del proyecto y la rama son obligatorias." }
    $configuracion.raizProyecto = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($configuracion.raizProyecto))
    if ($configuracion.rama -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $configuracion.rama.Contains("..")) {
        throw "El nombre de rama no es valido."
    }
    if (-not $configuracion.PSObject.Properties["remoto"]) { $configuracion | Add-Member -NotePropertyName remoto -NotePropertyValue "origin" }
    if (-not $configuracion.PSObject.Properties["urlRepositorio"]) { $configuracion | Add-Member -NotePropertyName urlRepositorio -NotePropertyValue "https://github.com/MonteroFernando/TaiLil_ERP.git" }
    if (-not $configuracion.PSObject.Properties["puertoWeb"]) { $configuracion | Add-Member -NotePropertyName puertoWeb -NotePropertyValue 3000 }
    if (-not $configuracion.PSObject.Properties["puertoApi"]) { $configuracion | Add-Member -NotePropertyName puertoApi -NotePropertyValue 8000 }
    return $configuracion
}

function Assert-ProyectoValido {
    param([Parameter(Mandatory = $true)]$Configuracion)
    $raiz = $Configuracion.raizProyecto
    $requeridos = @(
        ".git",
        ".env",
        "apps\api\alembic.ini",
        "apps\api\requirements.txt",
        "apps\web\package.json",
        "apps\web\package-lock.json",
        "deploy\windows\Iniciar-TaiLilERP.ps1",
        "deploy\windows\Detener-TaiLilERP.ps1"
    )
    if (-not (Test-Path -LiteralPath $raiz -PathType Container)) { throw "No existe el directorio configurado: $raiz" }
    foreach ($relativa in $requeridos) {
        if (-not (Test-Path -LiteralPath (Join-Path $raiz $relativa))) { throw "La carpeta no parece una instalacion valida. Falta: $relativa" }
    }
}

function Get-Comando {
    param([Parameter(Mandatory = $true)][string]$Nombre, [string]$Ayuda = "")
    $comando = Get-Command $Nombre -ErrorAction SilentlyContinue
    if (-not $comando) {
        $conocidos = @{
            "git.exe" = (Join-Path $env:ProgramFiles "Git\cmd\git.exe")
            "npm.cmd" = (Join-Path $env:ProgramFiles "nodejs\npm.cmd")
            "node.exe" = (Join-Path $env:ProgramFiles "nodejs\node.exe")
        }
        if ($conocidos.ContainsKey($Nombre) -and (Test-Path -LiteralPath $conocidos[$Nombre])) { return $conocidos[$Nombre] }
    }
    if (-not $comando) { throw "No se encontro $Nombre. $Ayuda" }
    return $comando.Source
}

function Update-PathProceso {
    $maquina = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $usuario = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$maquina;$usuario"
}

function Get-Winget {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) { return $winget.Source }
    $alias = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
    if (Test-Path -LiteralPath $alias) { return $alias }
    try { Start-Process "ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1" | Out-Null } catch { }
    throw "Windows Package Manager (winget) no esta instalado. Se abrio Microsoft Store: instale 'App Installer' y vuelva a ejecutar Preparar nueva PC."
}

function Install-PaqueteWinget {
    param(
        [string]$Winget,
        [string]$Id,
        [string]$Nombre,
        [string]$DirectorioActualizador,
        [string[]]$ArgumentosExtra = @(),
        [switch]$OcultarArgumentos
    )
    Set-EstadoActualizador $DirectorioActualizador "REQUISITOS" "Instalando $Nombre..." 12
    $argumentos = @("install", "--id", $Id, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity") + $ArgumentosExtra
    Invoke-Programa $Winget $argumentos $DirectorioActualizador "" @(0) -OcultarArgumentos:$OcultarArgumentos | Out-Null
    Update-PathProceso
}

function Get-PostgresBin {
    $psql = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($psql) { return (Split-Path $psql.Source -Parent) }
    $bases = @((Join-Path $env:ProgramFiles "PostgreSQL"), (Join-Path $env:ProgramFiles "PostgresPro"))
    foreach ($base in $bases) {
        if (-not (Test-Path -LiteralPath $base)) { continue }
        $encontrado = Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending |
            ForEach-Object { $bin = Join-Path $_.FullName "bin"; if (Test-Path -LiteralPath (Join-Path $bin "psql.exe")) { $bin } } | Select-Object -First 1
        if ($encontrado) { return $encontrado }
    }
    return $null
}

function New-ClaveSegura {
    param([int]$Longitud = 36)
    $alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $bytes = New-Object byte[] $Longitud
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $resultado = New-Object Text.StringBuilder
    foreach ($byte in $bytes) { [void]$resultado.Append($alfabeto[$byte % $alfabeto.Length]) }
    return $resultado.ToString()
}

function Set-ValorEnv {
    param([string]$Contenido, [string]$Nombre, [string]$Valor)
    $patron = "(?m)^" + [regex]::Escape($Nombre) + "=.*$"
    if ($Contenido -match $patron) { return [regex]::Replace($Contenido, $patron, "$Nombre=$Valor") }
    return $Contenido.TrimEnd() + "`r`n$Nombre=$Valor`r`n"
}

function Protect-ArchivoAdministrador {
    param([string]$Ruta)
    try {
        $acl = New-Object Security.AccessControl.FileSecurity
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($cuenta in @([Security.Principal.WindowsIdentity]::GetCurrent().Name, "BUILTIN\Administrators", "NT AUTHORITY\SYSTEM")) {
            $regla = New-Object Security.AccessControl.FileSystemAccessRule($cuenta, "FullControl", "Allow")
            [void]$acl.AddAccessRule($regla)
        }
        Set-Acl -LiteralPath $Ruta -AclObject $acl
    }
    catch { }
}

function Initialize-EnvNuevaPC {
    param($Configuracion, [string]$DirectorioActualizador, [string]$PasswordPostgres, [string]$PasswordAdmin)
    $rutaEnv = Join-Path $Configuracion.raizProyecto ".env"
    if (Test-Path -LiteralPath $rutaEnv) { return }
    $ejemplo = Join-Path $Configuracion.raizProyecto ".env.example"
    if (-not (Test-Path -LiteralPath $ejemplo)) { throw "El repositorio no contiene .env.example." }
    $contenido = Get-Content -LiteralPath $ejemplo -Raw
    $valores = [ordered]@{
        APP_ENV = "production"; APP_DEBUG = "false"; APP_SECRET_KEY = (New-ClaveSegura 48)
        POSTGRES_HOST = "localhost"; POSTGRES_PORT = "5432"; POSTGRES_DB = "TaiLil_ERP"; POSTGRES_USER = "postgres"; POSTGRES_PASSWORD = $PasswordPostgres
        JWT_ACCESS_SECRET = (New-ClaveSegura 48); JWT_REFRESH_SECRET = (New-ClaveSegura 48); PASSWORD_RESET_SECRET = (New-ClaveSegura 48)
        INITIAL_ADMIN_USERNAME = "admin"; INITIAL_ADMIN_PASSWORD = $PasswordAdmin
        COOKIE_SECURE = "false"; COOKIE_SAMESITE = "lax"; CORS_ORIGINS = "http://localhost:3000"; NEXT_PUBLIC_API_URL = "/api/v1"
    }
    foreach ($entrada in $valores.GetEnumerator()) { $contenido = Set-ValorEnv $contenido $entrada.Key $entrada.Value }
    [IO.File]::WriteAllText($rutaEnv, $contenido, (New-Object Text.UTF8Encoding($false)))
    Write-Registro $DirectorioActualizador "Archivo .env de produccion creado con claves aleatorias." | Out-Null
}

function Initialize-PostgresNuevaPC {
    param($Configuracion, [string]$DirectorioActualizador, [string]$PasswordPostgres)
    $bin = Get-PostgresBin
    if (-not $bin) { throw "PostgreSQL se instalo pero sus herramientas no fueron encontradas. Reinicie Windows y ejecute nuevamente Preparar nueva PC." }
    $pgIsReady = Join-Path $bin "pg_isready.exe"
    $psql = Join-Path $bin "psql.exe"
    $createdb = Join-Path $bin "createdb.exe"
    $listo = $false
    for ($intento = 0; $intento -lt 20; $intento++) {
        $comprobacion = Invoke-Programa $pgIsReady @("--host=localhost", "--port=5432") $DirectorioActualizador "" @(0, 1, 2, 3)
        if ($comprobacion.Codigo -eq 0) { $listo = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $listo) { throw "PostgreSQL no inicio. Reinicie Windows y vuelva a ejecutar la preparacion." }
    $passwordAnterior = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $PasswordPostgres
        $consulta = Invoke-Programa $psql @("--host=localhost", "--port=5432", "--username=postgres", "--dbname=postgres", "--tuples-only", "--no-align", "--command=SELECT 1 FROM pg_database WHERE datname='TaiLil_ERP'") $DirectorioActualizador
        if ($consulta.Salida.Trim() -ne "1") {
            Invoke-Programa $createdb @("--host=localhost", "--port=5432", "--username=postgres", "--encoding=UTF8", "TaiLil_ERP") $DirectorioActualizador | Out-Null
            Write-Registro $DirectorioActualizador "Base de datos TaiLil_ERP creada." | Out-Null
        }
    }
    finally { $env:PGPASSWORD = $passwordAnterior }
}

function Initialize-NuevaPC {
    param($Configuracion, [string]$DirectorioActualizador)
    $raiz = $Configuracion.raizProyecto
    Update-PathProceso
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    $faltaNode = -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)
    $faltaPython = -not (Get-Command py.exe -ErrorAction SilentlyContinue) -and -not (Get-Command python.exe -ErrorAction SilentlyContinue)
    $faltaPostgres = -not [bool](Get-PostgresBin)
    $winget = $null
    if (-not $git -or $faltaNode -or $faltaPython -or $faltaPostgres) { $winget = Get-Winget }
    if (-not $git) {
        Install-PaqueteWinget $winget "Git.Git" "Git para Windows" $DirectorioActualizador
        $rutaGit = Join-Path $env:ProgramFiles "Git\cmd\git.exe"
        if (Test-Path -LiteralPath $rutaGit) { $git = Get-Item $rutaGit } else { $git = Get-Command git.exe -ErrorAction SilentlyContinue }
    }
    if (-not $git) { throw "Git no quedo disponible. Reinicie Windows y repita la preparacion." }
    if ($faltaNode) { Install-PaqueteWinget $winget "OpenJS.NodeJS.LTS" "Node.js LTS" $DirectorioActualizador }
    if ($faltaPython) {
        try { Install-PaqueteWinget $winget "Python.Python.3.13" "Python 3" $DirectorioActualizador }
        catch { Install-PaqueteWinget $winget "Python.Python.3.12" "Python 3" $DirectorioActualizador }
    }

    $passwordPostgres = New-ClaveSegura 32
    $postgresExistia = -not $faltaPostgres
    if (Test-Path -LiteralPath $raiz) {
        $elementos = @(Get-ChildItem -LiteralPath $raiz -Force -ErrorAction SilentlyContinue)
        if ($elementos.Count -and -not (Test-Path -LiteralPath (Join-Path $raiz ".git"))) { throw "El directorio destino existe y no esta vacio. Elija una carpeta vacia para la nueva instalacion." }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $raiz ".git"))) {
        Set-EstadoActualizador $DirectorioActualizador "REPOSITORIO" "Clonando TaiLil ERP..." 30
        $padre = Split-Path $raiz -Parent
        if (-not $padre) { throw "El directorio raiz debe incluir una carpeta, por ejemplo C:\TaiLilERP." }
        New-Item -ItemType Directory -Path $padre -Force | Out-Null
        $programaGit = if ($git.PSObject.Properties["Source"]) { $git.Source } else { $git.FullName }
        Invoke-Programa $programaGit @("clone", "--branch", $Configuracion.rama, "--single-branch", $Configuracion.urlRepositorio, $raiz) $DirectorioActualizador | Out-Null
    }

    $passwordAdmin = New-ClaveSegura 20
    if (Test-Path -LiteralPath (Join-Path $raiz ".env")) {
        $variablesExistentes = Get-Content -LiteralPath (Join-Path $raiz ".env") -Raw
        if ($variablesExistentes -match '(?m)^POSTGRES_PASSWORD=(.+)$') { $passwordPostgres = $matches[1].Trim().Trim('"').Trim("'") }
        if ($variablesExistentes -match '(?m)^INITIAL_ADMIN_PASSWORD=(.+)$') { $passwordAdmin = $matches[1].Trim().Trim('"').Trim("'") }
    }
    else { Initialize-EnvNuevaPC $Configuracion $DirectorioActualizador $passwordPostgres $passwordAdmin }
    if (-not $postgresExistia) {
        $override = "--mode unattended --unattendedmodeui none --superpassword $passwordPostgres --serverport 5432"
        Install-PaqueteWinget $winget "PostgreSQL.PostgreSQL" "PostgreSQL" $DirectorioActualizador @("--override", $override) -OcultarArgumentos
    }
    if ($postgresExistia) { Write-Registro $DirectorioActualizador "PostgreSQL ya estaba instalado; se usara el password definido en .env." | Out-Null }
    Initialize-PostgresNuevaPC $Configuracion $DirectorioActualizador $passwordPostgres

    $credenciales = Join-Path $DirectorioActualizador "credenciales-iniciales.txt"
    if (-not (Test-Path -LiteralPath $credenciales)) {
        @("TaiLil ERP - credenciales de instalacion", "Generadas: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')", "Usuario inicial: admin", "Password inicial: $passwordAdmin", "Password PostgreSQL: $passwordPostgres", "Cambie el password del administrador despues del primer ingreso.") |
            Set-Content -LiteralPath $credenciales -Encoding UTF8
        Protect-ArchivoAdministrador $credenciales
    }
    $resultado = Update-TaiLil $Configuracion $DirectorioActualizador
    return "$resultado Nueva PC preparada. Credenciales iniciales protegidas en: $credenciales"
}

function Stop-TaiLil {
    param($Configuracion, [string]$DirectorioActualizador)
    Set-EstadoActualizador $DirectorioActualizador "DETENIENDO" "Deteniendo frontend y backend..." 25
    $powershell = (Get-Process -Id $PID).Path
    $scriptDetener = Join-Path $Configuracion.raizProyecto "deploy\windows\Detener-TaiLilERP.ps1"
    Invoke-Programa $powershell @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $scriptDetener, "-RaizProyecto", $Configuracion.raizProyecto) $DirectorioActualizador | Out-Null
}

function Start-TaiLil {
    param($Configuracion, [string]$DirectorioActualizador)
    Set-EstadoActualizador $DirectorioActualizador "INICIANDO" "Iniciando frontend y backend..." 88
    $powershell = (Get-Process -Id $PID).Path
    $scriptIniciar = Join-Path $Configuracion.raizProyecto "deploy\windows\Iniciar-TaiLilERP.ps1"
    Invoke-Programa $powershell @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $scriptIniciar, "-RaizProyecto", $Configuracion.raizProyecto, "-PuertoWeb", "$($Configuracion.puertoWeb)", "-PuertoApi", "$($Configuracion.puertoApi)") $DirectorioActualizador | Out-Null
}

function Test-Puerto {
    param([int]$Puerto)
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction SilentlyContinue)
}

function Test-SaludTaiLil {
    param($Configuracion, [string]$DirectorioActualizador)
    Set-EstadoActualizador $DirectorioActualizador "VERIFICANDO" "Comprobando API, frontend y acceso de red..." 95
    if (-not (Test-Puerto $Configuracion.puertoApi)) { throw "La API no esta escuchando en el puerto $($Configuracion.puertoApi)." }
    if (-not (Test-Puerto $Configuracion.puertoWeb)) { throw "El frontend no esta escuchando en el puerto $($Configuracion.puertoWeb)." }
    Invoke-WebRequest "http://127.0.0.1:$($Configuracion.puertoApi)/api/v1/sistema/estado" -UseBasicParsing -TimeoutSec 15 | Out-Null
    Invoke-WebRequest "http://127.0.0.1:$($Configuracion.puertoWeb)/api/v1/sistema/estado" -UseBasicParsing -TimeoutSec 15 | Out-Null
}

function Get-DireccionesTaiLil {
    param($Configuracion)
    $direcciones = @("http://localhost:$($Configuracion.puertoWeb)")
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
        $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "0.0.0.0"
    } | Sort-Object InterfaceMetric | Select-Object -ExpandProperty IPAddress -Unique
    foreach ($ip in $ips) { $direcciones += "http://$ip`:$($Configuracion.puertoWeb)" }
    return $direcciones
}

function Install-IntegracionWindows {
    param($Configuracion, [string]$DirectorioActualizador)
    Set-EstadoActualizador $DirectorioActualizador "WINDOWS" "Configurando inicio automatico y firewall privado..." 82
    $regla = Get-NetFirewallRule -DisplayName $script:NombreFirewall -ErrorAction SilentlyContinue
    if (-not $regla) {
        New-NetFirewallRule -DisplayName $script:NombreFirewall -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Configuracion.puertoWeb -Profile Private | Out-Null
        Write-Registro $DirectorioActualizador "Regla de firewall privado creada para el puerto $($Configuracion.puertoWeb)." | Out-Null
    }

    $worker = Join-Path $DirectorioActualizador "Ejecutar-Operacion.ps1"
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Operacion arranque -Silencioso' -f $worker
    $accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumentos
    $inicio = New-ScheduledTaskTrigger -AtStartup
    $opciones = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $script:NombreTarea -Action $accion -Trigger $inicio -Settings $opciones -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    Write-Registro $DirectorioActualizador "Inicio automatico de Windows configurado." | Out-Null
}

function Remove-IntegracionWindows {
    param($Configuracion, [string]$DirectorioActualizador)
    Set-EstadoActualizador $DirectorioActualizador "QUITANDO SERVICIO" "Deteniendo TaiLil ERP y quitando el inicio automatico..." 20
    $scriptDetener = Join-Path $Configuracion.raizProyecto "deploy\windows\Detener-TaiLilERP.ps1"
    if (Test-Path -LiteralPath $scriptDetener) {
        Stop-TaiLil $Configuracion $DirectorioActualizador
    }
    else {
        Write-Registro $DirectorioActualizador "AVISO: no se encontro el script del proyecto; se quitara igualmente la integracion de Windows." | Out-Null
    }

    $tarea = Get-ScheduledTask -TaskName $script:NombreTarea -ErrorAction SilentlyContinue
    if ($tarea) {
        Stop-ScheduledTask -TaskName $script:NombreTarea -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $script:NombreTarea -Confirm:$false
        Write-Registro $DirectorioActualizador "Tarea de inicio automatico eliminada." | Out-Null
    }
    else {
        Write-Registro $DirectorioActualizador "La tarea de inicio automatico ya no estaba instalada." | Out-Null
    }

    $reglas = @(Get-NetFirewallRule -DisplayName $script:NombreFirewall -ErrorAction SilentlyContinue)
    foreach ($regla in $reglas) { $regla | Remove-NetFirewallRule -Confirm:$false }
    if ($reglas.Count) { Write-Registro $DirectorioActualizador "Regla de firewall de TaiLil ERP eliminada." | Out-Null }
    return "Servicio quitado. El proyecto, la base de datos, la configuracion y los respaldos se conservaron."
}

function Initialize-Backend {
    param($Configuracion, [string]$DirectorioActualizador, [bool]$ActualizarDependencias)
    $raiz = $Configuracion.raizProyecto
    $pythonVenv = Join-Path $raiz ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $pythonVenv)) {
        Set-EstadoActualizador $DirectorioActualizador "BACKEND" "Creando el entorno Python..." 45
        $pythonBase = Get-Command py.exe -ErrorAction SilentlyContinue
        if ($pythonBase) {
            Invoke-Programa $pythonBase.Source @("-3", "-m", "venv", (Join-Path $raiz ".venv")) $DirectorioActualizador $raiz | Out-Null
        }
        else {
            $python = Get-Comando "python.exe" "Instale Python 3 para continuar."
            Invoke-Programa $python @("-m", "venv", (Join-Path $raiz ".venv")) $DirectorioActualizador $raiz | Out-Null
        }
        $ActualizarDependencias = $true
    }
    if ($ActualizarDependencias) {
        Set-EstadoActualizador $DirectorioActualizador "BACKEND" "Actualizando dependencias del backend..." 52
        Invoke-Programa $pythonVenv @("-m", "pip", "install", "-r", (Join-Path $raiz "apps\api\requirements.txt")) $DirectorioActualizador $raiz | Out-Null
    }
    return $pythonVenv
}

function Backup-BaseDatosSiCorresponde {
    param($Configuracion, [string]$DirectorioActualizador, [string]$ArchivosCambiados)
    if ($ArchivosCambiados -notmatch '(?m)^apps/api/migrations/') { return }
    Set-EstadoActualizador $DirectorioActualizador "RESPALDO" "Respaldando PostgreSQL antes de las migraciones..." 21
    $variables = @{}
    foreach ($linea in Get-Content -LiteralPath (Join-Path $Configuracion.raizProyecto ".env")) {
        if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $variables[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    if (-not $variables["POSTGRES_DB"] -or -not $variables["POSTGRES_USER"]) {
        Write-Registro $DirectorioActualizador "AVISO: no se pudo leer la configuracion PostgreSQL; el respaldo automatico se omitio." | Out-Null
        return
    }
    $pgDump = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
    if (-not $pgDump) {
        $basePostgres = Join-Path $env:ProgramFiles "PostgreSQL"
        if (Test-Path -LiteralPath $basePostgres) {
            $pgDump = Get-ChildItem -LiteralPath $basePostgres -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending |
                ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName "bin\pg_dump.exe") -ErrorAction SilentlyContinue } | Select-Object -First 1
        }
    }
    if (-not $pgDump) {
        Write-Registro $DirectorioActualizador "AVISO: pg_dump no esta disponible; el respaldo automatico se omitio." | Out-Null
        return
    }
    $directorioRespaldos = Join-Path $Configuracion.raizProyecto "logs\respaldos"
    New-Item -ItemType Directory -Path $directorioRespaldos -Force | Out-Null
    $archivo = Join-Path $directorioRespaldos ("antes-actualizacion-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    $passwordAnterior = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
        $argumentos = @("--format=custom", "--file=$archivo", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", $variables["POSTGRES_DB"])
        $programaPgDump = if ($pgDump.PSObject.Properties["Source"]) { $pgDump.Source } else { $pgDump.FullName }
        Invoke-Programa $programaPgDump $argumentos $DirectorioActualizador $Configuracion.raizProyecto | Out-Null
        Write-Registro $DirectorioActualizador "Respaldo previo guardado en $archivo" | Out-Null
    }
    finally {
        $env:PGPASSWORD = $passwordAnterior
    }
}

function Get-VariablesEnv {
    param([string]$RaizProyecto)
    $variables = @{}
    $ruta = Join-Path $RaizProyecto ".env"
    if (-not (Test-Path -LiteralPath $ruta)) { throw "No se encontro .env en $RaizProyecto." }
    foreach ($linea in Get-Content -LiteralPath $ruta) {
        if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $variables[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    foreach ($nombre in @("POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")) {
        if (-not $variables[$nombre]) { throw "Falta $nombre en .env." }
    }
    if ($variables["POSTGRES_PORT"] -notmatch '^\d{1,5}$') { throw "POSTGRES_PORT no es valido." }
    if ($variables["POSTGRES_DB"] -notmatch '^[A-Za-z0-9_]+$' -or $variables["POSTGRES_USER"] -notmatch '^[A-Za-z0-9_]+$') { throw "El nombre de base o usuario PostgreSQL no es valido." }
    return $variables
}

function Get-ClavesBackup {
    param([string]$Password, [byte[]]$Salt)
    if ($Password.Length -lt 10) { throw "El password del backup debe tener al menos 10 caracteres." }
    $derivador = New-Object Security.Cryptography.Rfc2898DeriveBytes($Password, $Salt, 200000, [Security.Cryptography.HashAlgorithmName]::SHA256)
    try {
        $material = $derivador.GetBytes(64)
        return [pscustomobject]@{ Cifrado = $material[0..31]; Firma = $material[32..63] }
    }
    finally { $derivador.Dispose() }
}

function Copy-StreamLimitado {
    param([IO.Stream]$Origen, [IO.Stream]$Destino, [long]$Cantidad)
    $buffer = New-Object byte[] 1048576
    $restante = $Cantidad
    while ($restante -gt 0) {
        $leer = [int][Math]::Min($buffer.Length, $restante)
        $cantidadLeida = $Origen.Read($buffer, 0, $leer)
        if ($cantidadLeida -le 0) { throw "El archivo de backup esta truncado." }
        $Destino.Write($buffer, 0, $cantidadLeida)
        $restante -= $cantidadLeida
    }
}

function Protect-BackupFile {
    param([string]$Origen, [string]$Destino, [string]$Password)
    $magic = [Text.Encoding]::ASCII.GetBytes("TAILILB1")
    $salt = New-Object byte[] 16
    $iv = New-Object byte[] 16
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($salt); $rng.GetBytes($iv) } finally { $rng.Dispose() }
    $claves = Get-ClavesBackup $Password $salt
    $cifradoTemporal = "$Destino.cifrado-$([guid]::NewGuid().ToString('N'))"
    $salidaTemporal = "$Destino.parcial-$([guid]::NewGuid().ToString('N'))"
    try {
        $aes = [Security.Cryptography.Aes]::Create()
        $aes.KeySize = 256; $aes.BlockSize = 128; $aes.Mode = "CBC"; $aes.Padding = "PKCS7"; $aes.Key = $claves.Cifrado; $aes.IV = $iv
        $entrada = [IO.File]::OpenRead($Origen)
        $salidaCifrada = [IO.File]::Create($cifradoTemporal)
        try {
            $crypto = New-Object Security.Cryptography.CryptoStream($salidaCifrada, $aes.CreateEncryptor(), [Security.Cryptography.CryptoStreamMode]::Write)
            try { $entrada.CopyTo($crypto) } finally { $crypto.Dispose() }
        }
        finally { $entrada.Dispose(); $salidaCifrada.Dispose(); $aes.Dispose() }

        $cabecera = New-Object byte[] 40
        [Array]::Copy($magic, 0, $cabecera, 0, 8); [Array]::Copy($salt, 0, $cabecera, 8, 16); [Array]::Copy($iv, 0, $cabecera, 24, 16)
        $hmac = New-Object Security.Cryptography.HMACSHA256(,$claves.Firma)
        $entradaCifrada = [IO.File]::OpenRead($cifradoTemporal)
        try {
            [void]$hmac.TransformBlock($cabecera, 0, $cabecera.Length, $null, 0)
            $buffer = New-Object byte[] 1048576
            while (($leidos = $entradaCifrada.Read($buffer, 0, $buffer.Length)) -gt 0) { [void]$hmac.TransformBlock($buffer, 0, $leidos, $null, 0) }
            [void]$hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0)
            $firma = $hmac.Hash
        }
        finally { $entradaCifrada.Dispose(); $hmac.Dispose() }

        $salida = [IO.File]::Create($salidaTemporal)
        $entradaCifrada = [IO.File]::OpenRead($cifradoTemporal)
        try { $salida.Write($cabecera, 0, $cabecera.Length); $entradaCifrada.CopyTo($salida); $salida.Write($firma, 0, $firma.Length) }
        finally { $entradaCifrada.Dispose(); $salida.Dispose() }
        Move-Item -LiteralPath $salidaTemporal -Destination $Destino -Force
    }
    finally {
        Remove-Item -LiteralPath $cifradoTemporal -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $salidaTemporal -Force -ErrorAction SilentlyContinue
    }
}

function Unprotect-BackupFile {
    param([string]$Origen, [string]$Destino, [string]$Password)
    $longitud = (Get-Item -LiteralPath $Origen).Length
    if ($longitud -lt 73) { throw "El archivo no es un backup TaiLil valido." }
    $entrada = [IO.File]::OpenRead($Origen)
    $cabecera = New-Object byte[] 40
    try {
        if ($entrada.Read($cabecera, 0, 40) -ne 40) { throw "El backup esta truncado." }
        if ([Text.Encoding]::ASCII.GetString($cabecera, 0, 8) -ne "TAILILB1") { throw "El archivo no corresponde a un backup TaiLil ERP." }
        $salt = $cabecera[8..23]; $iv = $cabecera[24..39]; $longitudCifrada = $longitud - 40 - 32
        $claves = Get-ClavesBackup $Password $salt
        $hmac = New-Object Security.Cryptography.HMACSHA256(,$claves.Firma)
        try {
            [void]$hmac.TransformBlock($cabecera, 0, 40, $null, 0)
            $buffer = New-Object byte[] 1048576; $restante = $longitudCifrada
            while ($restante -gt 0) {
                $leer = [int][Math]::Min($buffer.Length, $restante); $leidos = $entrada.Read($buffer, 0, $leer)
                if ($leidos -le 0) { throw "El backup esta truncado." }
                [void]$hmac.TransformBlock($buffer, 0, $leidos, $null, 0); $restante -= $leidos
            }
            [void]$hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0); $firmaCalculada = $hmac.Hash
            $firmaGuardada = New-Object byte[] 32
            if ($entrada.Read($firmaGuardada, 0, 32) -ne 32) { throw "El backup no contiene firma de integridad." }
            $diferencia = 0; for ($i = 0; $i -lt 32; $i++) { $diferencia = $diferencia -bor ($firmaCalculada[$i] -bxor $firmaGuardada[$i]) }
            if ($diferencia -ne 0) { throw "Password incorrecto o backup alterado." }
        }
        finally { $hmac.Dispose() }
    }
    finally { $entrada.Dispose() }

    $cifradoTemporal = "$Destino.cifrado"
    try {
        $entrada = [IO.File]::OpenRead($Origen); $entrada.Position = 40
        $cifrado = [IO.File]::Create($cifradoTemporal)
        try { Copy-StreamLimitado $entrada $cifrado $longitudCifrada } finally { $entrada.Dispose(); $cifrado.Dispose() }
        $aes = [Security.Cryptography.Aes]::Create()
        $aes.KeySize = 256; $aes.BlockSize = 128; $aes.Mode = "CBC"; $aes.Padding = "PKCS7"; $aes.Key = $claves.Cifrado; $aes.IV = $iv
        $entradaCifrada = [IO.File]::OpenRead($cifradoTemporal); $salida = [IO.File]::Create($Destino)
        try {
            $crypto = New-Object Security.Cryptography.CryptoStream($entradaCifrada, $aes.CreateDecryptor(), [Security.Cryptography.CryptoStreamMode]::Read)
            try { $crypto.CopyTo($salida) } finally { $crypto.Dispose() }
        }
        finally { $entradaCifrada.Dispose(); $salida.Dispose(); $aes.Dispose() }
    }
    finally { Remove-Item -LiteralPath $cifradoTemporal -Force -ErrorAction SilentlyContinue }
}

function Export-BackupTransportable {
    param($Configuracion, [string]$DirectorioActualizador, [string]$Destino, [string]$Password)
    Assert-ProyectoValido $Configuracion
    if ([IO.Path]::GetExtension($Destino) -ne ".taililbackup") { $Destino = "$Destino.taililbackup" }
    $padre = Split-Path $Destino -Parent
    if (-not $padre) { throw "Seleccione un directorio valido para el backup." }
    New-Item -ItemType Directory -Path $padre -Force | Out-Null
    $bin = Get-PostgresBin
    if (-not $bin) { throw "No se encontro pg_dump. Instale las herramientas de PostgreSQL." }
    $variables = Get-VariablesEnv $Configuracion.raizProyecto
    $temporal = Join-Path $env:TEMP ("tailil-backup-" + [guid]::NewGuid().ToString("N"))
    $contenido = Join-Path $temporal "contenido"; New-Item -ItemType Directory -Path $contenido -Force | Out-Null
    $dump = Join-Path $contenido "database.dump"; $zip = Join-Path $temporal "payload.zip"
    try {
        Set-EstadoActualizador $DirectorioActualizador "BACKUP" "Generando copia consistente de PostgreSQL..." 30
        $passwordAnterior = $env:PGPASSWORD
        try {
            $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
            Invoke-Programa (Join-Path $bin "pg_dump.exe") @("--format=custom", "--no-owner", "--no-privileges", "--file=$dump", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", $variables["POSTGRES_DB"]) $DirectorioActualizador $Configuracion.raizProyecto | Out-Null
        }
        finally { $env:PGPASSWORD = $passwordAnterior }
        Invoke-Programa (Join-Path $bin "pg_restore.exe") @("--list", $dump) $DirectorioActualizador | Out-Null
        $git = Get-Comando "git.exe"; $commit = (Invoke-Programa $git @("-C", $Configuracion.raizProyecto, "rev-parse", "HEAD") $DirectorioActualizador).Salida.Trim()
        $rama = (Invoke-Programa $git @("-C", $Configuracion.raizProyecto, "branch", "--show-current") $DirectorioActualizador).Salida.Trim()
        $versionPg = (Invoke-Programa (Join-Path $bin "pg_dump.exe") @("--version") $DirectorioActualizador).Salida.Trim()
        $passwordAnterior = $env:PGPASSWORD
        try {
            $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
            $versionServidor = (Invoke-Programa (Join-Path $bin "psql.exe") @("--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--dbname=$($variables['POSTGRES_DB'])", "--tuples-only", "--no-align", "--command=SHOW server_version_num") $DirectorioActualizador).Salida.Trim()
        }
        finally { $env:PGPASSWORD = $passwordAnterior }
        [ordered]@{ esquema = 1; aplicacion = "TaiLil ERP"; creado = (Get-Date).ToString("o"); base = $variables["POSTGRES_DB"]; gitCommit = $commit; gitRama = $rama; postgres = $versionPg; postgresServidor = $versionServidor; sha256 = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $contenido "manifest.json") -Encoding UTF8
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::CreateFromDirectory($contenido, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
        Set-EstadoActualizador $DirectorioActualizador "BACKUP" "Cifrando y firmando el paquete transportable..." 75
        Protect-BackupFile $zip $Destino $Password
        Write-Registro $DirectorioActualizador "Backup transportable creado: $Destino" | Out-Null
        return "Backup creado y verificado: $Destino"
    }
    finally { Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue }
}

function Import-BackupTransportable {
    param($Configuracion, [string]$DirectorioActualizador, [string]$Origen, [string]$Password)
    Assert-ProyectoValido $Configuracion
    if (-not (Test-Path -LiteralPath $Origen -PathType Leaf)) { throw "No existe el backup seleccionado." }
    $bin = Get-PostgresBin
    if (-not $bin) { throw "No se encontraron las herramientas de PostgreSQL." }
    $variables = Get-VariablesEnv $Configuracion.raizProyecto
    $temporal = Join-Path $env:TEMP ("tailil-restore-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temporal -Force | Out-Null
    $zip = Join-Path $temporal "payload.zip"; $contenido = Join-Path $temporal "contenido"; New-Item -ItemType Directory -Path $contenido | Out-Null
    $detenido = $false; $respaldoSeguridad = $null
    try {
        Set-EstadoActualizador $DirectorioActualizador "RESTAURAR" "Descifrando y verificando el backup..." 10
        Unprotect-BackupFile $Origen $zip $Password
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archivoZip = [IO.Compression.ZipFile]::OpenRead($zip)
        try {
            $permitidos = @("database.dump", "manifest.json")
            $encontrados = @{}
            foreach ($entrada in $archivoZip.Entries) {
                if ($permitidos -notcontains $entrada.FullName) { throw "El paquete contiene una entrada no permitida: $($entrada.FullName)" }
                if ($encontrados[$entrada.FullName]) { throw "El paquete contiene entradas duplicadas." }
                $encontrados[$entrada.FullName] = $true
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entrada, (Join-Path $contenido $entrada.FullName), $true)
            }
            if ($encontrados.Count -ne 2) { throw "El paquete no contiene exactamente los archivos requeridos." }
        }
        finally { $archivoZip.Dispose() }
        $dump = Join-Path $contenido "database.dump"; $manifestRuta = Join-Path $contenido "manifest.json"
        if (-not (Test-Path -LiteralPath $dump) -or -not (Test-Path -LiteralPath $manifestRuta)) { throw "El backup no contiene todos los archivos requeridos." }
        $manifest = Get-Content -LiteralPath $manifestRuta -Raw | ConvertFrom-Json
        if ($manifest.aplicacion -ne "TaiLil ERP" -or [int]$manifest.esquema -ne 1) { throw "Version de paquete no compatible." }
        if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $manifest.sha256) { throw "El dump no supera la verificacion SHA-256." }
        Invoke-Programa (Join-Path $bin "pg_restore.exe") @("--list", $dump) $DirectorioActualizador | Out-Null
        if ($manifest.postgresServidor) {
            $passwordAnterior = $env:PGPASSWORD
            try {
                $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
                $versionDestino = (Invoke-Programa (Join-Path $bin "psql.exe") @("--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--dbname=$($variables['POSTGRES_DB'])", "--tuples-only", "--no-align", "--command=SHOW server_version_num") $DirectorioActualizador).Salida.Trim()
            }
            finally { $env:PGPASSWORD = $passwordAnterior }
            $majorOrigen = [int]([long]$manifest.postgresServidor / 10000); $majorDestino = [int]([long]$versionDestino / 10000)
            if ($majorDestino -lt $majorOrigen) { throw "El backup proviene de PostgreSQL $majorOrigen y el destino usa $majorDestino. Instale la misma version o una superior antes de restaurar." }
        }
        if ($manifest.gitCommit) {
            $git = Get-Comando "git.exe"; $compatible = Invoke-Programa $git @("-C", $Configuracion.raizProyecto, "merge-base", "--is-ancestor", $manifest.gitCommit, "HEAD") $DirectorioActualizador "" @(0, 1)
            if ($compatible.Codigo -ne 0) { throw "El codigo del servidor destino es anterior o incompatible con el backup. Actualice Git antes de restaurar." }
        }

        Stop-TaiLil $Configuracion $DirectorioActualizador; $detenido = $true
        $directorioRespaldos = Join-Path $Configuracion.raizProyecto "logs\respaldos"; New-Item -ItemType Directory -Path $directorioRespaldos -Force | Out-Null
        $respaldoSeguridad = Join-Path $directorioRespaldos ("antes-restaurar-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
        $passwordAnterior = $env:PGPASSWORD
        try {
            $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
            Set-EstadoActualizador $DirectorioActualizador "RESTAURAR" "Creando respaldo preventivo del servidor destino..." 35
            Invoke-Programa (Join-Path $bin "pg_dump.exe") @("--format=custom", "--no-owner", "--no-privileges", "--file=$respaldoSeguridad", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", $variables["POSTGRES_DB"]) $DirectorioActualizador | Out-Null
            Set-EstadoActualizador $DirectorioActualizador "RESTAURAR" "Reemplazando la base de datos..." 55
            Invoke-Programa (Join-Path $bin "psql.exe") @("--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--dbname=postgres", "--command=SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$($variables['POSTGRES_DB'])' AND pid <> pg_backend_pid()") $DirectorioActualizador | Out-Null
            Invoke-Programa (Join-Path $bin "dropdb.exe") @("--if-exists", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", $variables["POSTGRES_DB"]) $DirectorioActualizador | Out-Null
            Invoke-Programa (Join-Path $bin "createdb.exe") @("--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--encoding=UTF8", $variables["POSTGRES_DB"]) $DirectorioActualizador | Out-Null
            Invoke-Programa (Join-Path $bin "pg_restore.exe") @("--exit-on-error", "--no-owner", "--no-privileges", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--dbname=$($variables['POSTGRES_DB'])", $dump) $DirectorioActualizador | Out-Null
        }
        finally { $env:PGPASSWORD = $passwordAnterior }
        $python = Join-Path $Configuracion.raizProyecto ".venv\Scripts\python.exe"
        Invoke-Programa $python @("-m", "alembic", "-c", (Join-Path $Configuracion.raizProyecto "apps\api\alembic.ini"), "upgrade", "head") $DirectorioActualizador $Configuracion.raizProyecto | Out-Null
        Start-TaiLil $Configuracion $DirectorioActualizador; Test-SaludTaiLil $Configuracion $DirectorioActualizador
        Write-Registro $DirectorioActualizador "Restauracion completada desde $Origen. Respaldo preventivo: $respaldoSeguridad" | Out-Null
        return "Backup restaurado y servicio verificado. Respaldo anterior: $respaldoSeguridad"
    }
    catch {
        $errorOriginal = $_.Exception.Message
        if ($detenido -and $respaldoSeguridad -and (Test-Path -LiteralPath $respaldoSeguridad)) {
            try {
                Write-Registro $DirectorioActualizador "La restauracion fallo. Recuperando la base anterior..." | Out-Null
                $passwordAnterior = $env:PGPASSWORD; $env:PGPASSWORD = $variables["POSTGRES_PASSWORD"]
                try {
                    Invoke-Programa (Join-Path $bin "dropdb.exe") @("--if-exists", "--force", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", $variables["POSTGRES_DB"]) $DirectorioActualizador | Out-Null
                    Invoke-Programa (Join-Path $bin "createdb.exe") @("--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--encoding=UTF8", $variables["POSTGRES_DB"]) $DirectorioActualizador | Out-Null
                    Invoke-Programa (Join-Path $bin "pg_restore.exe") @("--exit-on-error", "--no-owner", "--no-privileges", "--host=$($variables['POSTGRES_HOST'])", "--port=$($variables['POSTGRES_PORT'])", "--username=$($variables['POSTGRES_USER'])", "--dbname=$($variables['POSTGRES_DB'])", $respaldoSeguridad) $DirectorioActualizador | Out-Null
                }
                finally { $env:PGPASSWORD = $passwordAnterior }
                Start-TaiLil $Configuracion $DirectorioActualizador
                throw "$errorOriginal La base anterior fue recuperada automaticamente."
            }
            catch { if ($_.Exception.Message -like "$errorOriginal*") { throw }; throw "$errorOriginal Tambien fallo la recuperacion automatica: $($_.Exception.Message)" }
        }
        throw
    }
    finally { Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue }
}

function Install-BackupDiario {
    param($Configuracion, [string]$DirectorioActualizador)
    Assert-ProyectoValido $Configuracion
    $rutaConfig = Join-Path $DirectorioActualizador "backup-diario.json"
    if (-not (Test-Path -LiteralPath $rutaConfig)) { throw "Falta la configuracion del backup diario." }
    $backupConfig = Get-Content -LiteralPath $rutaConfig -Raw | ConvertFrom-Json
    if ($backupConfig.hora -notmatch '^(?:[01]\d|2[0-3]):[0-5]\d$') { throw "La hora del backup diario no es valida." }
    $retencion = [int]$backupConfig.retencion
    if ($retencion -lt 2 -or $retencion -gt 365) { throw "La retencion debe estar entre 2 y 365 backups." }
    $directorio = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($backupConfig.directorio))
    New-Item -ItemType Directory -Path $directorio -Force | Out-Null
    try {
        $aclDirectorio = Get-Acl -LiteralPath $directorio
        $reglaSystem = New-Object Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
        [void]$aclDirectorio.AddAccessRule($reglaSystem)
        Set-Acl -LiteralPath $directorio -AclObject $aclDirectorio
    }
    catch { Write-Registro $DirectorioActualizador "AVISO: no se pudo agregar permiso SYSTEM a la carpeta de backups: $($_.Exception.Message)" | Out-Null }
    $prueba = Join-Path $directorio (".tailil-prueba-" + [guid]::NewGuid().ToString("N"))
    try { [IO.File]::WriteAllText($prueba, "ok") } finally { Remove-Item -LiteralPath $prueba -Force -ErrorAction SilentlyContinue }

    $worker = Join-Path $DirectorioActualizador "Ejecutar-Operacion.ps1"
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Operacion backupautomatico -Silencioso' -f $worker
    $accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumentos
    $hora = [DateTime]::ParseExact($backupConfig.hora, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    $diario = New-ScheduledTaskTrigger -Daily -At $hora
    $opciones = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 6)
    Register-ScheduledTask -TaskName $script:NombreTareaBackup -Action $accion -Trigger $diario -Settings $opciones -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    Protect-ArchivoAdministrador $rutaConfig
    Write-Registro $DirectorioActualizador "Backup diario programado a las $($backupConfig.hora). Retencion: $retencion archivos. Destino: $directorio" | Out-Null
    return "Backup diario programado a las $($backupConfig.hora). Se conservaran los ultimos $retencion archivos."
}

function Remove-BackupDiario {
    param([string]$DirectorioActualizador)
    $tarea = Get-ScheduledTask -TaskName $script:NombreTareaBackup -ErrorAction SilentlyContinue
    if ($tarea) {
        Stop-ScheduledTask -TaskName $script:NombreTareaBackup -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $script:NombreTareaBackup -Confirm:$false
    }
    Remove-Item -LiteralPath (Join-Path $DirectorioActualizador "backup-diario.json") -Force -ErrorAction SilentlyContinue
    Write-Registro $DirectorioActualizador "Programacion de backup diario eliminada. Los archivos existentes se conservaron." | Out-Null
    return "Backup diario desprogramado. Las copias existentes se conservaron."
}

function Invoke-BackupDiario {
    param($Configuracion, [string]$DirectorioActualizador)
    $rutaConfig = Join-Path $DirectorioActualizador "backup-diario.json"
    if (-not (Test-Path -LiteralPath $rutaConfig)) { throw "No existe configuracion para el backup diario." }
    $backupConfig = Get-Content -LiteralPath $rutaConfig -Raw | ConvertFrom-Json
    $protegido = [Convert]::FromBase64String($backupConfig.passwordProtegido)
    $bytesPassword = [Security.Cryptography.ProtectedData]::Unprotect($protegido, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    $password = [Text.Encoding]::UTF8.GetString($bytesPassword)
    $directorio = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($backupConfig.directorio))
    New-Item -ItemType Directory -Path $directorio -Force | Out-Null
    $destino = Join-Path $directorio ("TaiLilERP-Automatico-{0}.taililbackup" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    $resultado = Export-BackupTransportable $Configuracion $DirectorioActualizador $destino $password
    $retencion = [int]$backupConfig.retencion
    $archivos = @(Get-ChildItem -LiteralPath $directorio -Filter "TaiLilERP-Automatico-*.taililbackup" -File | Sort-Object Name -Descending)
    if ($archivos.Count -gt $retencion) {
        foreach ($archivo in $archivos[$retencion..($archivos.Count - 1)]) {
            Remove-Item -LiteralPath $archivo.FullName -Force
            Write-Registro $DirectorioActualizador "Backup diario vencido eliminado: $($archivo.Name)" | Out-Null
        }
    }
    return "$resultado Retencion aplicada: $retencion archivos."
}

function Build-Frontend {
    param($Configuracion, [string]$DirectorioActualizador, [bool]$ActualizarDependencias)
    $directorioWeb = Join-Path $Configuracion.raizProyecto "apps\web"
    $npm = Get-Comando "npm.cmd" "Instale Node.js LTS para continuar."
    if ($ActualizarDependencias -or -not (Test-Path -LiteralPath (Join-Path $directorioWeb "node_modules"))) {
        Set-EstadoActualizador $DirectorioActualizador "FRONTEND" "Actualizando dependencias del frontend..." 60
        Invoke-Programa $npm @("ci") $DirectorioActualizador $directorioWeb | Out-Null
    }

    Set-EstadoActualizador $DirectorioActualizador "FRONTEND" "Generando el frontend de produccion..." 68
    $build = Join-Path $directorioWeb ".next"
    $respaldo = Join-Path (Join-Path $Configuracion.raizProyecto "logs") ("next-anterior-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Path (Split-Path $respaldo -Parent) -Force | Out-Null
    if (Test-Path -LiteralPath $build) { Move-Item -LiteralPath $build -Destination $respaldo }
    try {
        Invoke-Programa $npm @("run", "build") $DirectorioActualizador $directorioWeb | Out-Null
        if (Test-Path -LiteralPath $respaldo) { Remove-Item -LiteralPath $respaldo -Recurse -Force }
    }
    catch {
        if (Test-Path -LiteralPath $build) { Remove-Item -LiteralPath $build -Recurse -Force }
        if (Test-Path -LiteralPath $respaldo) { Move-Item -LiteralPath $respaldo -Destination $build }
        throw
    }
}

function Update-ActualizadorInstalado {
    param($Configuracion, [string]$DirectorioActualizador)
    $origen = Join-Path $Configuracion.raizProyecto "tools\actualizador-windows"
    if (-not (Test-Path -LiteralPath $origen)) { return }
    if ([IO.Path]::GetFullPath($origen).TrimEnd('\') -eq [IO.Path]::GetFullPath($DirectorioActualizador).TrimEnd('\')) { return }
    foreach ($archivo in @("TaiLilUpdater.Core.psm1", "TaiLil-Actualizador.ps1", "Ejecutar-Operacion.ps1", "Abrir-Actualizador.cmd", "Instalar-Actualizador.cmd", "Instalar-Actualizador.ps1", "README.md")) {
        $rutaOrigen = Join-Path $origen $archivo
        if (Test-Path -LiteralPath $rutaOrigen) { Copy-Item -LiteralPath $rutaOrigen -Destination (Join-Path $DirectorioActualizador $archivo) -Force }
    }
}

function Update-TaiLil {
    param($Configuracion, [string]$DirectorioActualizador)
    Assert-ProyectoValido $Configuracion
    $raiz = $Configuracion.raizProyecto
    $git = Get-Comando "git.exe" "Instale Git para Windows para continuar."
    $remoto = $Configuracion.remoto
    $rama = $Configuracion.rama

    Set-EstadoActualizador $DirectorioActualizador "GIT" "Consultando actualizaciones sin modificar archivos..." 5
    Invoke-Programa $git @("-C", $raiz, "fetch", "--prune", $remoto, $rama) $DirectorioActualizador | Out-Null
    $cambios = (Invoke-Programa $git @("-C", $raiz, "status", "--porcelain") $DirectorioActualizador).Salida
    if ($cambios) { throw "Git detecto cambios locales. La actualizacion se cancelo para no sobrescribirlos.`n$cambios" }

    $ramaActual = (Invoke-Programa $git @("-C", $raiz, "branch", "--show-current") $DirectorioActualizador).Salida.Trim()
    if ($ramaActual -ne $rama) {
        $local = Invoke-Programa $git @("-C", $raiz, "show-ref", "--verify", "--quiet", "refs/heads/$rama") $DirectorioActualizador "" @(0, 1)
        if ($local.Codigo -eq 0) {
            Invoke-Programa $git @("-C", $raiz, "checkout", $rama) $DirectorioActualizador | Out-Null
        }
        else {
            Invoke-Programa $git @("-C", $raiz, "checkout", "--track", "-b", $rama, "$remoto/$rama") $DirectorioActualizador | Out-Null
        }
    }

    $commitLocal = (Invoke-Programa $git @("-C", $raiz, "rev-parse", "HEAD") $DirectorioActualizador).Salida.Trim()
    $commitRemoto = (Invoke-Programa $git @("-C", $raiz, "rev-parse", "refs/remotes/$remoto/$rama") $DirectorioActualizador).Salida.Trim()
    $buildExiste = Test-Path -LiteralPath (Join-Path $raiz "apps\web\.next\BUILD_ID")
    $backendExiste = Test-Path -LiteralPath (Join-Path $raiz ".venv\Scripts\python.exe")
    $frontendInstalado = Test-Path -LiteralPath (Join-Path $raiz "apps\web\node_modules")
    $requiereDespliegue = ($commitLocal -ne $commitRemoto) -or (-not $buildExiste) -or (-not $backendExiste) -or (-not $frontendInstalado)

    if ($commitLocal -ne $commitRemoto) {
        $ancestro = Invoke-Programa $git @("-C", $raiz, "merge-base", "--is-ancestor", $commitLocal, $commitRemoto) $DirectorioActualizador "" @(0, 1)
        if ($ancestro.Codigo -ne 0) { throw "La rama local tiene commits propios o divergio del remoto. Resuelva Git manualmente; no se realizo ningun cambio." }
    }

    if (-not $requiereDespliegue) {
        Write-Registro $DirectorioActualizador "El repositorio ya esta actualizado en $($commitLocal.Substring(0, 8))." | Out-Null
        Install-IntegracionWindows $Configuracion $DirectorioActualizador
        Start-TaiLil $Configuracion $DirectorioActualizador
        Test-SaludTaiLil $Configuracion $DirectorioActualizador
        return "Sin cambios en Git. Servicios verificados."
    }

    $archivosCambiados = ""
    if ($commitLocal -ne $commitRemoto) {
        $archivosCambiados = (Invoke-Programa $git @("-C", $raiz, "diff", "--name-only", $commitLocal, $commitRemoto) $DirectorioActualizador).Salida
    }
    Backup-BaseDatosSiCorresponde $Configuracion $DirectorioActualizador $archivosCambiados
    Stop-TaiLil $Configuracion $DirectorioActualizador
    if ($commitLocal -ne $commitRemoto) {
        Set-EstadoActualizador $DirectorioActualizador "GIT" "Aplicando la actualizacion de la rama $rama..." 32
        Invoke-Programa $git @("-C", $raiz, "merge", "--ff-only", "refs/remotes/$remoto/$rama") $DirectorioActualizador | Out-Null
    }

    $actualizarBackend = (-not (Test-Path -LiteralPath (Join-Path $raiz ".venv\Scripts\python.exe"))) -or ($archivosCambiados -match '(?m)^(apps/api/requirements\.txt|apps/api/pyproject\.toml|requirements\.txt)$')
    $actualizarFrontend = (-not (Test-Path -LiteralPath (Join-Path $raiz "apps\web\node_modules"))) -or ($archivosCambiados -match '(?m)^apps/web/(package-lock\.json|package\.json)$')
    $pythonVenv = Initialize-Backend $Configuracion $DirectorioActualizador $actualizarBackend
    Build-Frontend $Configuracion $DirectorioActualizador $actualizarFrontend

    Set-EstadoActualizador $DirectorioActualizador "BASE DE DATOS" "Aplicando migraciones del backend..." 76
    Invoke-Programa $pythonVenv @("-m", "alembic", "-c", (Join-Path $raiz "apps\api\alembic.ini"), "upgrade", "head") $DirectorioActualizador $raiz | Out-Null
    Install-IntegracionWindows $Configuracion $DirectorioActualizador
    Start-TaiLil $Configuracion $DirectorioActualizador
    Test-SaludTaiLil $Configuracion $DirectorioActualizador
    Update-ActualizadorInstalado $Configuracion $DirectorioActualizador
    return "Actualizacion completada: $($commitRemoto.Substring(0, 8))."
}

Export-ModuleMember -Function Get-ConfiguracionActualizador, Set-EstadoActualizador, Write-Registro, Initialize-NuevaPC, Export-BackupTransportable, Import-BackupTransportable, Install-BackupDiario, Remove-BackupDiario, Invoke-BackupDiario, Update-TaiLil, Start-TaiLil, Stop-TaiLil, Test-SaludTaiLil, Get-DireccionesTaiLil, Install-IntegracionWindows, Remove-IntegracionWindows, Assert-ProyectoValido
