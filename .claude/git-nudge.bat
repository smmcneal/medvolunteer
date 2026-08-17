@echo off
REM ---------------------------------------------------------------
REM git-nudge.bat - pushes an EMPTY commit to main to retrigger
REM CI/webhooks (e.g. a Vercel build missed during a GitHub webhook
REM outage). Companion to the other .claude git scripts; output to
REM .claude\git-out.log.
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"

cd /d "%REPO%"

echo. > "%LOG%"
echo === git-nudge  %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo --- branch --- >> "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- empty commit --- >> "%LOG%"
git commit --allow-empty -m "chore: empty commit to retrigger Vercel build (webhook missed during GitHub outage)" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- push --- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
set PUSH_RC=%ERRORLEVEL%

echo. >> "%LOG%"
echo --- new head --- >> "%LOG%"
git log -2 --oneline >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo === DONE rc=%PUSH_RC% === >> "%LOG%"
exit /b %PUSH_RC%
