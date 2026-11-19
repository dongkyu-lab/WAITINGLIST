@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [상황실] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  start "" https://nodejs.org/ko/download
  echo.
  pause
  exit /b 1
)

if not exist "dashboard\server.mjs" (
  echo.
  echo [상황실] dashboard\server.mjs 파일이 없습니다.
  echo 이 파일은 ai-company 폴더 안에서 실행해야 합니다. 지금 위치: %cd%
  echo.
  pause
  exit /b 1
)

echo [상황실] 서버를 켭니다. 이 창을 닫으면 상황실도 꺼집니다.
rem 서버가 뜰 시간을 2초 준 뒤 기본 브라우저로 상황실을 연다
start "" /b cmd /c ping -n 3 127.0.0.1 ^>nul ^& rundll32 url.dll,FileProtocolHandler http://localhost:4747
node dashboard\server.mjs
echo.
echo [상황실] 서버가 멈췄습니다. 위 메시지를 확인하세요.
pause
