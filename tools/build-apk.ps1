$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$jdk = $env:JAVA_HOME
if ($jdk -and (Test-Path (Join-Path $jdk 'bin/java.exe'))) {
    $version = (& (Join-Path $jdk 'bin/java.exe') --version | Select-Object -First 1).ToString()
    if ($version -notmatch '(2[1-9]|[3-9][0-9])\.') { $jdk = $null }
} else { $jdk = $null }
if (-not $jdk) {
    $local = Join-Path $repo '.local/jdk21'
    $jdk = Get-ChildItem $local -Directory -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    if (-not $jdk) {
        New-Item -ItemType Directory -Force $local | Out-Null
        $zip = Join-Path $repo '.local/jdk21.zip'
        if (-not (Test-Path $zip)) {
            Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $zip
        }
        Expand-Archive -LiteralPath $zip -DestinationPath $local -Force
        $jdk = Get-ChildItem $local -Directory | Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $jdk) { throw 'JDK 21 is required to build the Android app.' }
$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH
Push-Location $repo
try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'fetch-vosk.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare offline French model.' }
    & npm run sync:android
    if ($LASTEXITCODE -ne 0) { throw 'Could not package game web files.' }
    Push-Location 'android'
    try {
        & .\gradlew.bat assembleDebug --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
} finally { Pop-Location }
