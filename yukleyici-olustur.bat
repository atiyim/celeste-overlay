@echo off
chcp 65001 >nul
title Celeste Overlay - Kurulum dosyasi olusturuluyor
cd /d "%~dp0"

echo.
echo === Bagimliliklar kuruluyor ===
call pnpm install
if errorlevel 1 goto hata

if exist "%USERPROFILE%\.tauri\overlay.key" set "TAURI_SIGNING_PRIVATE_KEY=%USERPROFILE%\.tauri\overlay.key"
if not defined TAURI_SIGNING_PRIVATE_KEY_PASSWORD set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="

echo.
echo === Kurulum dosyasi olusturuluyor (ilk seferde birkac dakika surer) ===
call pnpm tauri build
if errorlevel 1 goto hata

echo.
echo Hazir! Kurulum dosyasinin bulundugu klasor aciliyor.
start "" "src-tauri\target\release\bundle\nsis"
pause
exit /b 0

:hata
echo.
echo Bir hata olustu. Yukaridaki kirmizi satirlari kopyalayip gonder.
pause
exit /b 1
