# Build-time download only. The resulting APK contains the complete model.
$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $repo 'android/app/src/main/assets/vosk-fr'
if (Test-Path (Join-Path $target 'uuid')) {
    Write-Output 'Vosk French model already prepared.'
    exit 0
}
$cache = Join-Path $repo '.local/vosk'
New-Item -ItemType Directory -Force $cache | Out-Null
$zip = Join-Path $cache 'vosk-model-small-fr-0.22.zip'
if (-not (Test-Path $zip)) {
    Invoke-WebRequest 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip' -OutFile $zip
}
if ((Get-Item $zip).Length -lt 30000000) { throw 'Vosk download is incomplete.' }
Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force
$source = Join-Path $cache 'vosk-model-small-fr-0.22'
if (-not (Test-Path (Join-Path $source 'am'))) { throw 'Vosk archive has an unexpected layout.' }
New-Item -ItemType Directory -Force $target | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
Set-Content -Path (Join-Path $target 'uuid') -Value 'vosk-model-small-fr-0.22' -NoNewline
Write-Output 'Vosk French model copied into Android app assets.'
