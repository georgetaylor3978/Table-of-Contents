@echo off
echo ============================================
echo   Table-of-Contents - Update Script
echo ============================================
echo.
echo Committing to Git...
cd /d "%~dp0"
git add .
git commit -m "Automated update by update.bat"
git push
echo.
echo Done!
pause
