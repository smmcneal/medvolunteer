@echo off
REM ---------------------------------------------------------------
REM git-push.bat - stages everything, commits, pushes to main.
REM
REM Commit message is read from .claude\commit-msg.txt, which Claude
REM writes with the Write tool immediately before triggering this.
REM Aborts if that file is missing. Does NOT push if the commit
REM fails or if there was nothing to commit.
REM
REM All output lands in .claude\git-out.log for Claude to read back.
REM Runs native Windows git on purpose - see CLAUDE.md.
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"
set "MSG=%REPO%\.claude\commit-msg.txt"

cd /d "%REPO%"

echo. > "%LOG%"
echo === git-push  %DATE% %TIME% >> "%LOG%"

if not exist "%MSG%" (
  echo ABORT: no commit message file at %MSG% >> "%LOG%"
  echo === DONE rc=99 === >> "%LOG%"
  exit /b 99
)

echo. >> "%LOG%"
echo --- branch --- >> "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- commit message --- >> "%LOG%"
type "%MSG%" >> "%LOG%"

echo. >> "%LOG%"
echo --- staging --- >> "%LOG%"
git add -A >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- staged --- >> "%LOG%"
git diff --cached --stat >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- commit --- >> "%LOG%"
git commit -F "%MSG%" >> "%LOG%" 2>&1
set COMMIT_RC=%ERRORLEVEL%

if not "%COMMIT_RC%"=="0" (
  echo. >> "%LOG%"
  echo COMMIT rc=%COMMIT_RC% - nothing to commit or commit failed. NOT PUSHING. >> "%LOG%"
  echo === DONE rc=%COMMIT_RC% === >> "%LOG%"
  exit /b %COMMIT_RC%
)

echo. >> "%LOG%"
echo --- push --- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
set PUSH_RC=%ERRORLEVEL%

echo. >> "%LOG%"
echo --- new head --- >> "%LOG%"
git log -1 --oneline >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo === DONE rc=%PUSH_RC% === >> "%LOG%"
exit /b %PUSH_RC%
