# Pull an Ollama model directly via curl (IPv4), bypassing ollama's own downloader
# which hangs on this machine because Cloudflare R2 is reached over broken IPv6.
# Usage: & 'D:\DSh Open\tools\pull-model.ps1' -Model "qwen2.5:7b"
param(
  [Parameter(Mandatory = $true)][string]$Model,
  [string]$Registry = 'registry.ollama.ai',
  [string]$ModelsDir = 'D:\Ollama\models'
)

$ErrorActionPreference = 'Stop'

if ($Model -match ':') { $name = $Model.Split(':')[0]; $tag = $Model.Split(':')[1] }
else { $name = $Model; $tag = 'latest' }

$blobsDir = Join-Path $ModelsDir 'blobs'
$manifestDir = Join-Path $ModelsDir "manifests\$Registry\library\$name"
New-Item -ItemType Directory -Force -Path $blobsDir, $manifestDir | Out-Null

$tmp = Join-Path $ModelsDir "_manifest-$name-$tag.json"
$manifestUrl = "https://$Registry/v2/library/$name/manifests/$tag"
Write-Host "[1/3] fetch manifest: $manifestUrl"
& curl.exe -4 -s -L --max-time 60 -H "Accept: application/vnd.docker.distribution.manifest.v2+json" -o $tmp $manifestUrl
if (-not (Test-Path $tmp)) { throw "manifest download failed" }

$raw = Get-Content $tmp -Raw
if ($raw.Length -lt 50) { throw "manifest content invalid: $raw" }
$j = $raw | ConvertFrom-Json

$items = @($j.config) + @($j.layers)
$total = ($items | Measure-Object -Property size -Sum).Sum
Write-Host ("[2/3] {0} files, total {1:N1} GB" -f $items.Count, ($total / 1GB))

foreach ($it in $items) {
  $hex = $it.digest -replace '^sha256:', ''
  $dest = Join-Path $blobsDir "sha256-$hex"
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -eq $it.size)) {
    Write-Host "  skip (exists) $($hex.Substring(0,12))"
    continue
  }
  $url = "https://$Registry/v2/library/$name/blobs/sha256:$hex"
  Write-Host ("  download {0}  {1:N0} bytes" -f $hex.Substring(0, 12), $it.size)
  & curl.exe -4 -L -s -S --fail --retry 8 --retry-delay 3 --retry-all-errors `
    --connect-timeout 15 --speed-time 60 --speed-limit 1024 `
    -o $dest $url
  if ($LASTEXITCODE -ne 0) { throw "download failed: $url" }
  $got = (Get-Item $dest).Length
  if ($got -ne $it.size) { throw "size mismatch: expected $($it.size) got $got ($hex)" }
}

$manifestPath = Join-Path $manifestDir $tag
Copy-Item $tmp $manifestPath -Force
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

Write-Host "[3/3] done: $Model"
Write-Host "      $manifestPath"
