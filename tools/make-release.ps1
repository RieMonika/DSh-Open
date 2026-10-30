# 打发布包（zip）：源码取这份副本，运行时/桌宠素材取自同级的 DShOpen 文件夹，绝不带 data / cache
$ErrorActionPreference = 'Stop'
$Root   = Split-Path -Parent $PSScriptRoot
$Main   = Join-Path (Split-Path $Root) 'DShOpen'
$Stage  = Join-Path $Main 'cache\release\DShOpen'
$RelDir = Join-Path $Main 'cache\release'
$Ver    = (Get-Content (Join-Path $Root 'app\package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$Runtime = Join-Path $Main 'runtime'

Write-Host ''
Write-Host "== 打发布包 v$Ver ==" -ForegroundColor Cyan
if (-not (Test-Path $Runtime)) { throw "找不到运行时目录 $Runtime" }
New-Item -ItemType Directory -Path $RelDir -Force | Out-Null

Write-Host '1/5 清理旧 staging'
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }

Write-Host '2/5 拷运行时'
robocopy $Runtime (Join-Path $Stage 'runtime') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "拷运行时失败（robocopy $LASTEXITCODE）" }

Write-Host '3/5 换成本副本的源码 + 插件 + 桌宠素材 + 说明'
robocopy (Join-Path $Root 'app') (Join-Path $Stage 'runtime\resources\app') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
robocopy (Join-Path $Root 'plugins') (Join-Path $Stage 'plugins') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
$webm = Join-Path $Main 'pet-native\assets\webm'
if (Test-Path $webm) {
    robocopy $webm (Join-Path $Stage 'pet-native\assets\webm') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
} else {
    Write-Host '   没有 pet-native\assets\webm，桌宠用 app\assets\pet 的兜底素材' -ForegroundColor Yellow
}
foreach ($f in @('启动.bat', '创建桌面快捷方式.bat', 'README.md', 'LICENSE')) {
    $src = Join-Path $Root $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $Stage $f) -Force }
}
$readme = Join-Path $Main '使用说明.txt'
if (Test-Path $readme) { Copy-Item $readme (Join-Path $Stage '使用说明.txt') -Force }

$size = [math]::Round(((Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "   staging: $size MB"

Write-Host '4/5 打 zip'
$zip = Join-Path $RelDir ("DShOpen-{0}-win-x64.zip" -f $Ver)
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$zipMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ("   {0}: {1} MB" -f (Split-Path -Leaf $zip), $zipMb)

Write-Host '5/5 自检：里面不能有 data / cache / 本机路径'
$bad = @()
$zipObj = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    foreach ($e in $zipObj.Entries) {
        if ($e.FullName -match '^(DShOpen/)?(data|cache)/') { $bad += $e.FullName }
    }
} finally { $zipObj.Dispose() }
if ($bad.Count) { throw ('发布包里混进了不该带的目录：' + ($bad -join ', ')) }

$leak = @()
Get-ChildItem $Stage -Recurse -File | Where-Object { $_.Extension -in '.js', '.json', '.md', '.txt', '.bat', '.html', '.ps1' } | ForEach-Object {
    $userRoot = 'C:' + '\' + 'Users' + '\'
    $hit = Select-String -LiteralPath $_.FullName -Pattern $userRoot -SimpleMatch -ErrorAction SilentlyContinue
    if ($hit) { $leak += $_.FullName }
}
if ($leak.Count) { throw ('发布包里发现本机路径：' + ($leak -join ', ')) }

Write-Host ''
Write-Host "干净：没有 data / cache，也没有本机路径。文件在 $zip" -ForegroundColor Green
