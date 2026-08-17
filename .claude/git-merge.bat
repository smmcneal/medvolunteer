@echo off
REM ---------------------------------------------------------------
REM git-merge.bat - merges the branch named in .claude\merge-branch.txt
REM into main with the message in .claude\merge-msg.txt (line 1).
REM On clean merge: pushes origin main. On conflict: logs the
REM conflicted files and stops so the agent can resolve + finish
REM with git-push.bat. Output: .claude\git-out.log
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"

cd /d "%REPO%"

set /p BRANCH=<"%REPO%\.claude\merge-branch.txt"
set /p MSG=<"%REPO%\.claude\merge-msg.txt"

echo. > "%LOG%"
echo === git-merge %BRANCH%  %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo --- checkout main + ff pull --- >> "%LOG%"
git checkout main >> "%LOG%" 2>&1
git pull --ff-only origin main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- merge %BRANCH% --- >> "%LOG%"
git merge --no-ff "%BRANCH%" -m "%MSG%" >> "%LOG%" 2>&1
if errorlevel 1 goto :conflict

echo. >> "%LOG%"
echo --- push --- >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo --- new head --- >> "%LOG%"
git log -2 --oneline >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo === DONE rc=0 MERGED+PUSHED === >> "%LOG%"
goto :eof

:conflict
echo. >> "%LOG%"
echo --- CONFLICT: unmerged files --- >> "%LOG%"
git diff --name-only --diff-filter=U >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo --- status --- >> "%LOG%"
git status --short >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo === DONE rc=1 CONFLICT - resolve then run git-push.bat === >> "%LOG%"
