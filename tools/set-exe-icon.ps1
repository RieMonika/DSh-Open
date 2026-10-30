# -*- coding: utf-8 -*-
<#
    把 app\assets\app-icon.ico 塞进 runtime\DShOpen.exe 的内嵌图标资源里。
    C# 部分在同目录 set-exe-icon.cs（用 -Path 加载，避免 here-string 被编码搞坏）。

    做法：ICO 里每一档图覆盖 RT_ICON 1..N（原来的 4 档原子球图被直接覆盖，不留孤立资源），
    再把 RT_GROUP_ICON 1 重写成指向这些图。

    用法：powershell -NoProfile -ExecutionPolicy Bypass -File tools\set-exe-icon.ps1
    注意：本文件必须保存为 UTF-8 带 BOM，否则 PowerShell 5.1 会按 GBK 解析出错。
#>
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Exe  = Join-Path $Root 'runtime\DShOpen.exe'
$Ico  = Join-Path $Root 'app\assets\app-icon.ico'
$Cs   = Join-Path $PSScriptRoot 'set-exe-icon.cs'

if (-not (Test-Path $Exe)) { throw "missing $Exe" }
if (-not (Test-Path $Ico)) { throw "missing $Ico" }
if (-not (Test-Path $Cs))  { throw "missing $Cs" }

Add-Type -Path $Cs
$r = [IcoInjector]::Apply($Exe, $Ico)
Write-Host "exe icon updated: $r" -ForegroundColor Green
