@echo off
title LapGuard-AI Unified Startup Script
echo ========================================================
echo   Starting LapGuard-AI Services
echo ========================================================
echo.

echo [1/3] Starting React Frontend (Vite)...
start "LapGuard Frontend" cmd /k "npm run dev"

echo [2/3] Starting Node.js Authentication Backend...
start "LapGuard Auth Backend" cmd /k "cd auth-backend && npm start"

echo [3/3] Starting Python Hardware Monitor Backend...
start "LapGuard Python Backend" cmd /k "cd backend && python app.py"

echo.
echo ========================================================
echo   All services have been launched in separate windows!
echo   - Frontend: http://localhost:5173
echo   - Auth Backend: http://localhost:5051
echo   - Python Backend: http://localhost:5050
echo ========================================================
echo.
pause
