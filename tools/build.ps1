# -*- coding: utf-8 -*-
<#
    一键构建：把 app/ 同步进 runtime/resources/app，并（重新）创建桌面快捷方式。
    不需要联网、不需要 npm，直接用本机已有的 Electron 运行时。
    注意：本文件必须保存为 UTF-8 带 BOM，否则 Windows PowerShell 5.1 会按 GBK 解析出错。
#>

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent $PSScriptRoot
$AppSrc    = Join-Path $Root 'app'
$Runtime   = Join-Path $Root 'runtime'
$AppDst    = Join-Path $Runtime 'resources\app'
$Exe       = Join-Path $Runtime 'DShOpen.exe'
$Icon      = Join-Path $AppSrc 'assets\app-icon.ico'
$Plugins   = Join-Path $Root 'plugins'

# 数据和缓存都在软件目录里面（整个软件 = 一个文件夹）
$DataRoot  = Join-Path $Root 'data'
$CacheRoot = Join-Path $Root 'cache'

Write-Host ''
Write-Host '== DSh Open 构建 ==' -ForegroundColor Cyan
Write-Host "软件目录   : $Root"
Write-Host "数据目录   : $DataRoot"
Write-Host "缓存目录   : $CacheRoot"

if (-not (Test-Path $Exe)) {
    throw "找不到运行时 $Exe。请确认 runtime\ 目录完整。"
}

# ---------------------------------------------------------------------------
# 1. 关闭正在运行的实例（否则文件被占用，同步会失败）
# ---------------------------------------------------------------------------
$running = Get-Process -Name 'DShOpen' -ErrorAction SilentlyContinue
if ($running) {
    Write-Host '检测到客户端正在运行，先关闭...' -ForegroundColor Yellow
    $running | Stop-Process -Force
    Start-Sleep -Milliseconds 700
}

# ---------------------------------------------------------------------------
# 2. 同步 app -> runtime/resources/app
# ---------------------------------------------------------------------------
if (-not (Test-Path $AppDst)) { New-Item -ItemType Directory -Path $AppDst -Force | Out-Null }
robocopy $AppSrc $AppDst /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "同步源码失败（robocopy 退出码 $LASTEXITCODE）" }
Write-Host "源码已同步 : $AppDst" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3. 各类目录（全部在 D 盘，plugins 是用户放插件的地方，构建不覆盖）
# ---------------------------------------------------------------------------
foreach ($d in @($DataRoot, $CacheRoot, $Plugins)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# ---------------------------------------------------------------------------
# 4. exe 内嵌图标（随时跟 app\assets\app-icon.ico 保持同步）
# ---------------------------------------------------------------------------
$IconTool = Join-Path $PSScriptRoot 'set-exe-icon.ps1'
if (Test-Path $IconTool) {
    try { & $IconTool } catch { Write-Host "exe 图标没更新（不影响使用）: $($_.Exception.Message)" -ForegroundColor Yellow }
}

# ---------------------------------------------------------------------------
# 5. 桌面快捷方式
# ---------------------------------------------------------------------------
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'DSh Open.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath       = $Exe
$sc.WorkingDirectory = $Runtime
$sc.IconLocation     = "$Icon,0"
$sc.Description      = 'DSh Open 多平台消息客户端'
$sc.WindowStyle      = 1
$sc.Save()
Write-Host "桌面快捷方式: $lnkPath" -ForegroundColor Green

Write-Host ''
Write-Host '构建完成。' -ForegroundColor Cyan