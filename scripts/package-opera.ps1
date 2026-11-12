$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distDir = Join-Path $root "dist"

$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$manifest.version
if (-not $version) {
    throw "Could not read version from manifest.json"
}

foreach ($locale in @("en", "ru")) {
    $msgPath = Join-Path $root "_locales/$locale/messages.json"
    if (-not (Test-Path $msgPath)) {
        throw "Missing locale file: $msgPath"
    }
    $msgJson = Get-Content $msgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $descLen = ([string]$msgJson.extDescription.message).Length
    if ($descLen -gt 132) {
        throw "Locale '$locale' extDescription exceeds 132 chars ($descLen)"
    }
}

foreach ($iconRel in $manifest.icons.PSObject.Properties.Value) {
    $iconFull = Join-Path $root $iconRel
    if (-not (Test-Path $iconFull)) {
        throw "Missing icon declared in manifest.json: $iconRel"
    }
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$zipPath = Join-Path $distDir "LierEX-opera-v$version.zip"
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

$includeFiles = @(
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "LICENSE",
    "_locales\en\messages.json",
    "_locales\ru\messages.json",
    "icons\icon16.png",
    "icons\icon32.png",
    "icons\icon48.png",
    "icons\icon64.png",
    "icons\icon128.png"
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($rel in $includeFiles) {
        $srcFile = Join-Path $root $rel
        if (-not (Test-Path $srcFile)) {
            throw "Required runtime file not found: $rel"
        }
        $entryName = $rel -replace "\\", "/"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip,
            $srcFile,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zip.Dispose()
}

Write-Host "Created Opera Add-ons package: $zipPath" -ForegroundColor Green
