@echo off
echo Solucionando problema de Prisma...
echo.
echo Cerrando procesos de Node.js...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Limpiando cache de Prisma...
rmdir /s /q node_modules\.prisma 2>nul
rmdir /s /q node_modules\@prisma 2>nul

echo Regenerando cliente de Prisma...
call npx prisma generate

echo.
echo ¡Listo! Ahora puedes ejecutar: npm run build
pause
