@echo off
echo ========================================================
echo INICIANDO EL SISTEMA DE RECURSOS HUMANOS (PORTABLE MODE)
echo ========================================================
echo.

set PATH=%~dp0node-v20.11.1-win-x64;%PATH%

echo Comprobando dependencias... (Esto puede tardar un poco si es la primera vez)
call npm install

echo.
echo ========================================================
echo Encendiendo el servidor...
echo Manten esta ventana abierta. Puedes minimizarla.
echo Cuando termine de cargar, entra en tu navegador a:
echo http://localhost:3000
echo ========================================================
echo.

npm run dev
pause
