# 给 NapCat 建一个「开机自动、以管理员身份运行」的计划任务
# 目的：以后 DSh Open 的一键启动可以直接 schtasks /run 把它拉起来，不再弹 UAC。
# 只在第一次需要管理员授权（运行本脚本时那个 UAC 框）。
# 全部英文输出，避免 PowerShell 5.1 把 UTF-8 中文读成乱码。
#
# 用法（把路径换成你自己的 NapCat 启动器）：
#   powershell -File tools\napcat-task.ps1 -Bat "C:\NapCat\launcher-win10.bat"

param(
  [string]$Bat = 'C:\NapCat\launcher-win10.bat'
)

$ErrorActionPreference = 'Stop'

$TaskName = 'DShOpen NapCat'
$WorkDir = Split-Path -Parent $Bat

if (-not (Test-Path -LiteralPath $Bat)) {
  Write-Host "MISSING: $Bat"
  exit 2
}

try {
  schtasks /Query /TN $TaskName 2>$null | Out-Null
} catch {
  # 没有就算了，下面 Register 会覆盖
}

$action = New-ScheduledTaskAction -Execute $Bat -WorkingDirectory $WorkDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
Write-Host ("OK: " + $task.TaskName + " state=" + $task.State)
