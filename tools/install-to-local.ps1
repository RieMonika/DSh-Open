# 把这份副本的源码装到同级的 DShOpen 文件夹（自己用的那一份）里试用
param([switch]$NoStart)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Main = Join-Path (Split-Path $Root) 'DShOpen'
$Exe  = Join-Path $Main 'runtime\DShOpen.exe'
$Dst  = Join-Path $Main 'runtime\resources\app'

Write-Host ''
Write-Host '== 装到本机试用 ==' -ForegroundColor Cyan
Write-Host "源码: $(Join-Path $Root 'app')"
Write-Host "目标: $Dst"
if (-not (Test-Path $Exe)) { throw "找不到 $Exe —— 确认同级目录里有 DShOpen 文件夹、且没被改名。" }

$running = Get-Process -Name 'DShOpen' -ErrorAction SilentlyContinue
if ($running) {
    Write-Host '先关掉正在运行的 DSh Open...' -ForegroundColor Yellow
    $running | Stop-Process -Force
    Start-Sleep -Milliseconds 800
}

robocopy (Join-Path $Root 'app') $Dst /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "复制失败（robocopy $LASTEXITCODE）" }
Write-Host '源码已同步。' -ForegroundColor Green

if (-not $NoStart) {
    $env:ELECTRON_RUN_AS_NODE = ''
    $env:DSH_OPEN_DEBUG = ''
    Start-Process -FilePath $Exe -WorkingDirectory (Join-Path $Main 'runtime')
    Start-Sleep -Seconds 6
    $n = (Get-Process -Name 'DShOpen' -ErrorAction SilentlyContinue).Count
    Write-Host "已启动，进程数 $n。" -ForegroundColor Green
}