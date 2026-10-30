# 一次性把提交钩子接上（每个 clone 只需要跑一次）
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\setup-hooks.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

git config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) { throw 'git config 失败' }
Write-Host '已启用提交前检查：.githooks/pre-commit'
Write-Host '想加自己的敏感词：写进 cache\private-banlist.txt（一行一个，不会进仓库）'
