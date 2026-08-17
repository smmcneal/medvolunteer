@echo off
REM ---------------------------------------------------------------
REM git-pull.bat - fast-forwards local main to origin/main.
REM
REM Companion to git-status.bat / git-push.bat: run by Claude via
REM File Explorer double-click, native Windows git, output to
REM .claude\git-out.log. Uses --ff-only so it can never create a
REM merge; if local has diverged or an uncommitted file would be
REM overwritten, git refuses and the log shows why.
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"

cd /d "%REPO%"

echo. > "%LOG%"
echo === git-pull  %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo --- branch --- >> "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- local state before pull --- >> "%LOG%"
git status --short >> "%LOG%" 2>&1
git log -1 --oneline >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- pull --ff-only --- >> "%LOG%"
git pull --ff-only origin main >> "%LOG%" 2>&1
set PULL_RC=%ERRORLEVEL%

echo. >> "%LOG%"
echo --- new head --- >> "%LOG%"
git log -1 --oneline >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo === DONE rc=%PULL_RC% === >> "%LOG%"
exit /b %PULL_RC%
