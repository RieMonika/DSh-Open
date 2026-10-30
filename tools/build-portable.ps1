# 打便携版发布包（zip）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-portable.ps1
# 前置：先跑过 tools\build.ps1（把 app 同步进 runtime）
$ErrorActionPreference = 'Stop'
$Root  = Split-Path -Parent $PSScriptRoot
$Stage = Join-Path $Root 'cache\release\DShOpen'
$Rel   = Join-Path $Root 'cache\release'
$Ver   = (Get-Content (Join-Path $Root 'app\package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version

Write-Host "== 1/4 清理旧 staging =="
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

Write-Host "== 2/4 拷 runtime / plugins / 桌宠素材 / 说明 =="
robocopy (Join-Path $Root 'runtime')  (Join-Path $Stage 'runtime')  /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy (Join-Path $Root 'plugins')  (Join-Path $Stage 'plugins')  /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
$webm = Join-Path $Root 'pet-native\assets\webm'
if (Test-Path $webm) {
  robocopy $webm (Join-Path $Stage 'pet-native\assets\webm') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host ("   桌宠素材: {0} 个" -f (Get-ChildItem (Join-Path $Stage 'pet-native\assets\webm') -File).Count)
} else {
  Write-Host "   没有 pet-native\assets\webm，发布包里桌宠用 app\assets\pet 的兜底素材"
}
foreach ($f in @('启动.bat', '创建桌面快捷方式.bat', 'README.md', 'LICENSE')) {
  $src = Join-Path $Root $f
  if (Test-Path $src) { Copy-Item $src $Stage -Force }
}
$readme = [System.IO.File]::ReadAllText((Join-Path $Root 'installer\使用说明.txt'), [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $Stage '使用说明.txt'), $readme, (New-Object System.Text.UTF8Encoding($true)))
$size = [math]::Round(((Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "   staging: $size MB"

Write-Host "== 3/4 打 zip =="
$zip = Join-Path $Rel ("DShOpen-{0}-win-x64.zip" -f $Ver)
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)
Write-Host ("   {0}: {1} MB" -f (Split-Path -Leaf $zip), [math]::Round((Get-Item $zip).Length / 1MB, 1))

Write-Host "== 4/4 自检：zip 里不能有 data / cache / 本机路径 =="
$bad = @()
$zipObj = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  foreach ($e in $zipObj.Entries) {
    if ($e.FullName -match '^(DShOpen/)?(data|cache)/') { $bad += $e.FullName }
  }
} finally { $zipObj.Dispose() }
if ($bad.Count) { throw ("发布包里混进了不该带的目录：" + ($bad -join ', ')) }
Write-Host "   干净：没有 data / cache"
Write-Host "完成。"
