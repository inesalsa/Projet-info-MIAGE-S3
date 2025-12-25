@echo off
echo ================================================
echo    LANCEMENT DU SYSTEME C.Q.C.D_ (MODE MISTRAL)
echo ================================================

:: 1. Lancer le serveur Node.js en arrière-plan
echo Démarrage du serveur CQCD...
start node server.js

:: 2. Attendre que le serveur démarre (2 secondes)
timeout /t 2 >nul

:: 3. Ouvrir le site dans le navigateur par défaut
echo Ouverture du portail...
start http://localhost:3000

echo.
echo ================================================
echo    SYSTEME EN LIGNE. ACCES: http://localhost:3000
echo    Appuyez sur une touche pour fermer cette fenêtre.
echo ================================================
pause