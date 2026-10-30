@echo off
chcp 65001 >nul
rem 清理掉可能被外部环境注入的 ELECTRON_RUN_AS_NODE，避免 Electron 被当成 Node 跑
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0runtime\DShOpen.exe"
