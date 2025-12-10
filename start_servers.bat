@echo off
REM 启动 N.E.K.O 所有服务器
REM 在四个独立的 cmd 窗口中启动 main_server, memory_server, agent_server, user_plugin_server

echo Starting N.E.K.O servers...

REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM 检查虚拟环境是否存在
if not exist ".venv\Scripts\activate.bat" (
    echo Error: Virtual environment not found at .venv\Scripts\activate.bat
    echo Please run: uv venv
    pause
    exit /b 1
)

REM 启动 main_server
echo Starting main_server...
start "N.E.K.O Main Server" cmd /k ".venv\Scripts\activate.bat && python main_server.py"

REM 等待一下，避免端口冲突
timeout /t 2 /nobreak >nul

REM 启动 memory_server
echo Starting memory_server...
start "N.E.K.O Memory Server" cmd /k ".venv\Scripts\activate.bat && python memory_server.py"

REM 等待一下
timeout /t 2 /nobreak >nul

REM 启动 agent_server
echo Starting agent_server...
start "N.E.K.O Agent Server" cmd /k ".venv\Scripts\activate.bat && python agent_server.py"

REM 等待一下
timeout /t 2 /nobreak >nul

REM 启动 user_plugin_server
echo Starting user_plugin_server...
start "N.E.K.O User Plugin Server" cmd /k ".venv\Scripts\activate.bat && python plugin\user_plugin_server.py"

echo.
echo All servers started in separate windows.
echo.
:choice
set /p choice="Close all servers? (y/n): "
if /i "%choice%"=="y" goto shutdown
if /i "%choice%"=="n" goto end
echo Invalid choice. Please enter y or n.
goto choice

:shutdown
echo.
echo Shutting down all servers...
REM 通过进程命令行查找并关闭服务器
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST 2^>nul ^| findstr /C:"PID:"') do (
    for /f "delims=" %%b in ('wmic process where "ProcessId=%%a" get CommandLine /value 2^>nul') do (
        set "line=%%b"
        setlocal enabledelayedexpansion
        echo !line! | findstr /C:"main_server.py" >nul && taskkill /PID %%a /T /F >nul 2>&1
        echo !line! | findstr /C:"memory_server.py" >nul && taskkill /PID %%a /T /F >nul 2>&1
        echo !line! | findstr /C:"agent_server.py" >nul && taskkill /PID %%a /T /F >nul 2>&1
        echo !line! | findstr /C:"user_plugin_server.py" >nul && taskkill /PID %%a /T /F >nul 2>&1
        endlocal
    )
)

echo All servers closed.
timeout /t 2 /nobreak >nul
goto end

:end
exit

