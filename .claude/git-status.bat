@echo off
REM ---------------------------------------------------------------
REM git-status.bat - READ ONLY. Changes nothing.
REM
REM Run by Claude (Cowork) via File Explorer double-click, because
REM the Cowork Linux sandbox serves TRUNCATED files and its git
REM output is fiction. This runs native Windows git against the
REM real working tree and dumps everything to .claude\git-out.log,
REM which Claude reads back with the Read tool.
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"

cd /d "%REPO%"

echo. > "%LOG%"
echo === git-status  %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo --- branch --- >> "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- status --- >> "%LOG%"
git status --short >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- diffstat vs HEAD --- >> "%LOG%"
git diff HEAD --stat >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- fetch origin --- >> "%LOG%"
git fetch origin main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- ahead/behind   left=origin/main  right=local --- >> "%LOG%"
git rev-list --left-right --count origin/main...HEAD >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- remote auth check --- >> "%LOG%"
git ls-remote --heads origin main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- recent history --- >> "%LOG%"
git log -5 --oneline >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo === DONE rc=%ERRORLEVEL% === >> "%LOG%"
