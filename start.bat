@echo off
cd /d "%~dp0control"
node scripts/build-prompt.js
npm start
