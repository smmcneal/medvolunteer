@echo off
REM ---------------------------------------------------------------
REM git-pr.bat - READ ONLY. Changes nothing in the working tree.
REM Fetches nightly-agent PR heads and dumps their diffs to files
REM so Claude (remote Cowork) can review them accurately.
REM Output: .claude\git-out.log, .claude\pr-21.diff, .claude\pr-22.diff
REM ---------------------------------------------------------------
setlocal
set "REPO=C:\Users\smmcn\Projects\medvolunteer"
set "LOG=%REPO%\.claude\git-out.log"

cd /d "%REPO%"

echo. > "%LOG%"
echo === git-pr  %DATE% %TIME% >> "%LOG%"

echo. >> "%LOG%"
echo --- fetch origin main + PR heads --- >> "%LOG%"
git fetch origin main +refs/pull/21/head:refs/heads/pr-21 +refs/pull/22/head:refs/heads/pr-22 >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- ahead/behind  left=origin/main  right=local main --- >> "%LOG%"
git rev-list --left-right --count origin/main...main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- pr-21 commits --- >> "%LOG%"
git log --oneline origin/main..pr-21 >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo --- pr-21 diffstat --- >> "%LOG%"
git diff --stat origin/main...pr-21 >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo --- pr-22 commits --- >> "%LOG%"
git log --oneline origin/main..pr-22 >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo --- pr-22 diffstat --- >> "%LOG%"
git diff --stat origin/main...pr-22 >> "%LOG%" 2>&1

git diff origin/main...pr-21 > "%REPO%\.claude\pr-21.diff" 2>&1
git diff origin/main...pr-22 > "%REPO%\.claude\pr-22.diff" 2>&1

echo. >> "%LOG%"
echo --- overlap: files touched by BOTH PRs --- >> "%LOG%"
git diff --name-only origin/main...pr-21 > "%TEMP%\pr21files.txt" 2>&1
git diff --name-only origin/main...pr-22 > "%TEMP%\pr22files.txt" 2>&1
findstr /g:"%TEMP%\pr21files.txt" "%TEMP%\pr22files.txt" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo === DONE rc=%ERRORLEVEL% === >> "%LOG%"
