@echo off
chcp 65001 >nul
setlocal
set "HERE=%~dp0"
echo 正在创建桌面快捷方式...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$h = ('%HERE%' -replace '\\\\$',''); $exe = Join-Path $h 'runtime\DShOpen.exe'; if (-not (Test-Path $exe)) { Write-Host '找不到 runtime\DShOpen.exe —— 请把这个文件放在程序目录（和 runtime 文件夹同级）里再运行。'; exit 1 }; $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'DSh Open.lnk'; $sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($lnk); $s.TargetPath = $exe; $s.WorkingDirectory = $h; $s.IconLocation = ($exe + ',0'); $s.Description = 'DSh Open'; $s.Save(); Write-Host ('已创建：' + $lnk)"
if errorlevel 1 (
  echo.
  echo 创建失败。可以手动：右键 runtime\DShOpen.exe →「发送到」→「桌面快捷方式」。
)
echo.
pause
