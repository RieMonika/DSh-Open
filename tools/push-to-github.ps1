# 把这份副本的改动提交并推到 GitHub
# 用法：双击仓库根目录的「提交并上传.bat」，或 powershell -File tools\push-to-github.ps1 "提交说明"
param([string]$Message = '')

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '== 提交并上传到 GitHub ==' -ForegroundColor Cyan
git add -A

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host '没有改动，不用提交。' -ForegroundColor Yellow
    exit 0
}

if (-not $Message) { $Message = '更新：' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }

Write-Host '-- 安全闸门：扫一遍要提交的内容（本机路径 / 邮箱 / 手机号 / 密钥）' -ForegroundColor Cyan
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'check-leaks.ps1') -Staged
if ($LASTEXITCODE -ne 0) {
    Write-Host '检查没过，已取消提交（上面列出了命中的文件和行）。' -ForegroundColor Red
    exit 1
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host '提交失败。' -ForegroundColor Red; exit 1 }

git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host '推送失败（网络或凭据问题），改动还在本地。' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '已上传。GitHub 上的内容现在和这份副本一致。' -ForegroundColor Green
git --no-pager log --oneline -1