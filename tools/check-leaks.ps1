# 检查仓库里有没有"不该公开的本机信息"
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\check-leaks.ps1
#   powershell ... tools\check-leaks.ps1 -Staged        # 只查已 git add 的文件
#   powershell ... tools\check-leaks.ps1 -Banlist cache\private-banlist.txt
# 命中任何一条都会 exit 1，用来当 pre-commit / CI 闸门。

param(
  [switch]$Staged,
  [string]$Banlist = '',
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'

if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }
Set-Location $Root

# 这些路径不查：第三方依赖整包拷进来，里面的作者邮箱不是我们的
$skipPath = '^app/node_modules/'

$textExt = '\.(md|js|mjs|cjs|jsx|ts|tsx|json|html|css|scss|txt|bat|cmd|ps1|nsi|nsh|yml|yaml|toml|ini|cfg|sh)$'

if ($Staged) {
  $files = git diff --cached --name-only --diff-filter=ACM
} else {
  $files = git ls-files
}

# 检查器自己写着规则关键词，别自己抓自己
$skipSelf = '^(tools/check-leaks\.ps1|\.github/workflows/leak-guard\.yml)$'

$files = $files | Where-Object {
  $_ -and $_ -notmatch $skipPath -and $_ -notmatch $skipSelf -and ($_ -match $textExt -or $_ -eq '.gitignore' -or $_ -eq 'LICENSE')
} | Where-Object { Test-Path -LiteralPath $_ }

# 明确允许的写法：软件自己的目录、NapCat 的通用示例路径、占位号码
$allowValues = @(
  '1122334455', '123456789', '987654321', '12345678', '10001', '61920', '11434'
)

$rules = [ordered]@{
  'Windows 用户名路径' = '[A-Za-z]:\\+Users\\+[^\\\s]+'
  '个人邮箱'           = '(?i)[A-Za-z0-9._%+-]+@(qq|163|126|sina|gmail|outlook|foxmail|hotmail|yeah)\.(com|net|cn)'
  '手机号'             = '(?<!\d)1[3-9]\d{9}(?!\d)'
  'QQ 号'              = '(?i)(qq\s*号|管理员\s*qq\s*[:：=]?\s*)([1-9]\d{4,11})'
  '疑似密钥'           = '(sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._-]{25,})'
  '本机私有目录'       = '(?i)(\\\\\.dsh\\\\|/\.dsh/|plugin-src)'
  '绝对路径（非示例）' = '(?i)(?<![A-Za-z0-9_])[A-Z]:\\+(?!DSh Open|NapCat|图片|Users)[A-Za-z0-9_\u4e00-\u9fa5 .-]{2,}'
}

$banWords = @()
if ($Banlist -and (Test-Path -LiteralPath $Banlist)) {
  $banWords = Get-Content -LiteralPath $Banlist -Encoding UTF8 |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith('#') }
}

$hits = New-Object System.Collections.ArrayList

foreach ($f in $files) {
  $lines = [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $f), [System.Text.Encoding]::UTF8)
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    foreach ($name in $rules.Keys) {
      foreach ($m in [regex]::Matches($line, $rules[$name])) {
        $val = $m.Groups[$m.Groups.Count - 1].Value
        if ($allowValues -contains $val) { continue }
        [void]$hits.Add([pscustomobject]@{ 规则 = $name; 文件 = $f; 行 = ($i + 1); 内容 = $m.Value.Trim() })
      }
    }
    foreach ($w in $banWords) {
      if ($line.IndexOf($w, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        [void]$hits.Add([pscustomobject]@{ 规则 = '本地黑名单'; 文件 = $f; 行 = ($i + 1); 内容 = $w })
      }
    }
  }
}

if ($hits.Count -eq 0) {
  Write-Host ("check-leaks: 干净（查了 " + $files.Count + " 个文件" + $(if ($banWords.Count) { "，黑名单 " + $banWords.Count + " 条" } else { "" }) + "）")
  exit 0
}

Write-Host ("check-leaks: 发现 " + $hits.Count + " 处可能泄露的信息：") -ForegroundColor Red
$hits | Select-Object -First 50 | ForEach-Object {
  Write-Host ("  [" + $_.规则 + "] " + $_.文件 + ":" + $_.行 + " => " + $_.内容) -ForegroundColor Yellow
}
Write-Host "如果确认这些只是示例，请改成通用写法（比如 <你的目录> / 000000），不要提交真路径和真号码。" -ForegroundColor Red
exit 1
