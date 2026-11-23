@echo off
title Compilador Local APK - Medico Bacis (100%% Offline)
echo =====================================================================
echo   COMPILADOR DE APK ANDROID - MEDICO BACIS (GRUPO MINERO BACIS)
echo =====================================================================
echo.

where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Java JDK 17 en esta computadora.
  echo Instala Eclipse Temurin / Zulu JDK 17 y Android Studio SDK,
  echo o ejecuta el workflow "Compilar APK Android Medico Bacis" en GitHub Actions.
  pause
  exit /b 1
)

cd /d "%~dp0.."
echo [1/3] Sincronizando archivos web offline en android-medico...
xcopy /E /I /Y "public\medico-app\*" "android-medico\app\src\main\assets\public\" >nul
copy /Y "capacitor.medico.config.json" "android-medico\app\src\main\assets\capacitor.config.json" >nul

echo [2/3] Compilando APK Android con Gradle...
cd android-medico
call gradlew.bat assembleDebug --stacktrace
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion Gradle. Revisa ANDROID_HOME y JDK 17.
  pause
  exit /b 1
)

echo [3/3] Copiando APK final...
copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\MedicoBacis-100-Offline-Android.apk" >nul
echo.
echo [LISTO] APK generado en: MedicoBacis-100-Offline-Android.apk
pause
