# ========================================================
#  Aether Mirror - Windows .lnk Shortcut Generator
#  Creates shortcuts on Windows Desktop & Start Menu
# ========================================================
param (
    [string]$InstallDir = $PSScriptRoot
)

if (-not $InstallDir) {
    $InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$StartMenuPath = [Environment]::GetFolderPath("Programs")
$TargetBat = Join-Path $InstallDir "start.bat"
$IconFile = Join-Path $InstallDir "public\icon.ico"

Write-Host "Creating Windows shortcuts..." -ForegroundColor Cyan
Write-Host "  Target: $TargetBat"
Write-Host "  Icon:   $IconFile"

# 1. Desktop Shortcut (.lnk)
if (Test-Path $DesktopPath) {
    $DesktopShortcutPath = Join-Path $DesktopPath "Aether Mirror.lnk"
    $Shortcut = $WshShell.CreateShortcut($DesktopShortcutPath)
    $Shortcut.TargetPath = $TargetBat
    $Shortcut.WorkingDirectory = $InstallDir
    if (Test-Path $IconFile) {
        $Shortcut.IconLocation = "$IconFile,0"
    }
    $Shortcut.Description = "Aether Mirror - Ultra-Low-Latency Android Screen Mirroring"
    $Shortcut.Save()
    Write-Host "  ✔ Created Desktop shortcut: $DesktopShortcutPath" -ForegroundColor Green
}

# 2. Start Menu Shortcut (.lnk)
if (Test-Path $StartMenuPath) {
    $MenuShortcutPath = Join-Path $StartMenuPath "Aether Mirror.lnk"
    $Shortcut = $WshShell.CreateShortcut($MenuShortcutPath)
    $Shortcut.TargetPath = $TargetBat
    $Shortcut.WorkingDirectory = $InstallDir
    if (Test-Path $IconFile) {
        $Shortcut.IconLocation = "$IconFile,0"
    }
    $Shortcut.Description = "Aether Mirror - Ultra-Low-Latency Android Screen Mirroring"
    $Shortcut.Save()
    Write-Host "  ✔ Created Start Menu shortcut: $MenuShortcutPath" -ForegroundColor Green
}

Write-Host "✔ Windows shortcuts generated successfully!" -ForegroundColor Green
