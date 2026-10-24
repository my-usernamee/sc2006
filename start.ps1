$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
function Invoke-Npm {
    & npm @args
    if ($LASTEXITCODE -ne 0) { throw "npm command failed; see the error above." }
}
if (!(Test-Path "node_modules")) { Invoke-Npm ci }
Invoke-Npm run install:all
Invoke-Npm run db:deploy
Invoke-Npm run dev
