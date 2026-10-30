# -*- coding: utf-8 -*-
<#
    一次性下载 Electron 运行时到 runtime\ —— 仓库里不带 300MB 的运行时，克隆后跑一次这个就行。

    用法（在仓库根目录）：
        powershell -ExecutionPolicy Bypass -File tools\fetch-runtime.ps1

    需要联网。下载完会：
        - 解压到 runtime\
        - 把 electron.exe 改名成 DShOpen.exe（build.ps1 认这个名字）
        - 删掉 Electron 自带的 default_app.asar（不然会盖住我们的界面）

    注意：本文件必须保存为 UTF-8 带 BOM，否则 Windows PowerShell 5.1 会按 GBK 解析出错。
#>

$ErrorActionPreference = 'Stop'

$Root    = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root 'runtime'
$Exe     = Join-Path $Runtime 'DShOpen.exe'
$Version = '43.3.0'

Write-Host ''
Write-Host '== DSh Open 运行时下载 ==' -ForegroundColor Cyan

if (Test-Path $Exe) {
    Write-Host "runtime\ 已经存在（$Exe），跳过。" -ForegroundColor Green
    exit 0
}

$Url = "https://github.com/electron/electron/releases/download/v$Version/electron-v$Version-win32-x64.zip"
$Zip = Join-Path $env:TEMP "electron-v$Version-win32-x64.zip"

Write-Host "下载 : $Url"
Write-Host '大小 : 约 120 MB，慢的话等一会儿...' -ForegroundColor DarkGray
Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing

Write-Host '解压...' -ForegroundColor DarkGray
if (-not (Test-Path $Runtime)) { New-Item -ItemType Directory -Path $Runtime -Force | Out-Null }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $Runtime)

$Electron = Join-Path $Runtime 'electron.exe'
if (Test-Path $Electron) { Move-Item -Path $Electron -Destination $Exe -Force }

$DefaultApp = Join-Path $Runtime 'resources\default_app.asar'
if (Test-Path $DefaultApp) { Remove-Item $DefaultApp -Force }

Remove-Item $Zip -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "完成 : $Exe" -ForegroundColor Green
Write-Host '下一步: 双击 构建.bat（同步源码 + 写 exe 图标 + 建桌面快捷方式），然后 启动.bat' -ForegroundColor Cyan

# 数据/缓存/插件目录先占位，免得第一次启动报错
foreach ($d in @('data', 'cache', 'plugins')) {
    $p = Join-Path $Root $d
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}
