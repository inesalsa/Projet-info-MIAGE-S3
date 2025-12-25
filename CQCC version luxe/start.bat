@echo off
echo ================================================
echo    LANCEMENT DU SYSTEME C.Q.C.D_ (MODE LOCAL)
echo ================================================

:: 1. Tuer les anciennes instances d'Ollama pour éviter les conflits
taskkill /f /im ollama_app.exe >nul 2>&1

:: 2. Configurer les permissions CORS (Vital pour que le site parle à l'IA)
set OLLAMA_ORIGINS=*

:: 3. Lancer Ollama en arrière-plan
echo Demarrage du moteur IA (Ollama)...
start /B ollama serve

:: 4. Attendre un peu que l'IA se reveille
timeout /t 3 >nul

:: 5. Lancer le serveur Node.js et ouvrir le navigateur
echo Démarrage du serveur CQCD...
start node server.js

echo.
echo ================================================
echo    SYSTEME EN LIGNE. ACCES: http://localhost:3000
echo ================================================
pause
