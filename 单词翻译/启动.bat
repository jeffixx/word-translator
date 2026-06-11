@echo off
chcp 65001 >nul
echo ========================================
echo   瞬译单词助手 - 启动器
echo ========================================
echo.

cd /d "%~dp0"

echo 正在启动翻译代理服务器(端口8081)...
start "翻译代理" python translate-proxy.py

echo 正在启动HTTP服务器(端口8080)...
echo.
echo 打开 http://localhost:8080 开始使用
echo.

python -m http.server 8080

pause