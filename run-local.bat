@echo off
REM Windows batch to build and run docker container
set PORT=%PORT%
if "%PORT%"=="" set PORT=3000
docker build -t yaramisaya:latest .
if not ""=="%ERRORLEVEL%" (
  echo build ok
)
REM remove old container if exists
for /f "tokens=*" %%i in ('docker ps -a -q -f name=yaramisaya') do (
  docker rm -f %%i >nul 2>&1
)
mkdir data 2>nul
docker run -d --name yaramisaya -p %PORT%:3000 -v %cd%\data:/usr/src/app/data yaramisaya:latest
echo App running at http://localhost:%PORT%
