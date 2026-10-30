@echo off
rem Clear ELECTRON_RUN_AS_NODE so the app starts as Electron, not as Node.
rem Clear DSH_OPEN_DEBUG if an earlier debug launcher exported it.
set "ELECTRON_RUN_AS_NODE="
set "DSH_OPEN_DEBUG="
start "" "%~dp0runtime\DShOpen.exe"
