@echo off
setlocal EnableExtensions
title Xadrez de Caderno
rem Trabalha sempre a partir da pasta deste arquivo
cd /d "%~dp0"

echo.
echo  ==============================
echo     Xadrez de Caderno
echo  ==============================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado.
  echo Instale a versao LTS em https://nodejs.org e execute este arquivo novamente.
  goto :erro
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao foi encontrado. Reinstale o Node.js ^(o npm vem junto^).
  goto :erro
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo Node.js encontrado: %NODE_VER%
if %NODE_MAJOR% LSS 18 (
  echo [ERRO] E preciso Node.js 18 ou mais recente.
  goto :erro
)

set "PRECISA_INSTALAR="
for %%d in (vite chess.js @fontsource\playwrite-br @fontsource\patrick-hand) do (
  if not exist "node_modules\%%d\package.json" set "PRECISA_INSTALAR=1"
)
if defined PRECISA_INSTALAR (
  echo.
  echo Instalando dependencias ^(na primeira vez ou depois de uma atualizacao^)...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar as dependencias. Verifique a conexao com a internet.
    goto :erro
  )
)

echo.
echo Iniciando o servidor local em http://127.0.0.1:5173
echo ^(o navegador deve abrir sozinho; para encerrar, feche esta janela ou use Ctrl+C^)
echo.
call npm run dev
if errorlevel 1 (
  echo.
  echo [ERRO] O servidor terminou com erro. Veja as mensagens acima.
  goto :erro
)
echo.
echo Servidor encerrado.
pause
exit /b 0

:erro
echo.
pause
exit /b 1
