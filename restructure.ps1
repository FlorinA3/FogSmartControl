# restructure.ps1
# =========================================
# 1) Verify we’re in the right folder:
if (-not (Test-Path -Path ".\package.json" -PathType Leaf)) {
  Write-Host "❌ No package.json found. Run from your project root." -ForegroundColor Red
  exit 1
}

# 2) Uninstall all Firebase deps from the React app:
Write-Host "→ Removing Firebase dependencies…" -ForegroundColor Cyan
npm uninstall firebase

# 3) Create and move to /server
if (!(Test-Path server)) { mkdir server }
Write-Host "→ Moving backend files into /server…" -ForegroundColor Cyan
# Move your server.js (and any other backend scripts) into /server
Move-Item server.js, package.json, start-script.ps1 -Destination server -ErrorAction SilentlyContinue

# 4) Scaffold server/package.json
Write-Host "→ Creating server/package.json…" -ForegroundColor Cyan
@"
{
  "name": "fog-smart-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^8.6.0",
    "node-cron": "^3.0.2",
    "serialport": "^11.0.0"
  }
}
"@ | Out-File server\package.json -Encoding utf8

# 5) Create and move to /client
if (!(Test-Path client)) { mkdir client }
Write-Host "→ Moving React app into /client…" -ForegroundColor Cyan
Move-Item src, public, yarn.lock, package.json, package-lock.json -Destination client

# 6) Clean up leftover Firebase files in client
Write-Host "→ Stripping firebase imports from React code…" -ForegroundColor Cyan
Get-ChildItem client\src -Include *.js,*.jsx -Recurse | ForEach-Object {
  (Get-Content $_.FullName) `
    -replace 'import.*firebase.*;', '' `
    -replace 'const.*firebaseConfig.*\{[\s\S]*?\}\);', '' `
  | Set-Content $_.FullName
}
# Optionally delete context/services if you created them:
Remove-Item client\src\context\AuthContext.js -ErrorAction SilentlyContinue
Remove-Item client\src\services\auth.service.js,client\src\services\fog.service.js -ErrorAction SilentlyContinue

# 7) Install backend and frontend deps
Write-Host "→ Installing backend dependencies…" -ForegroundColor Cyan
Push-Location server
npm install
Pop-Location

Write-Host "→ Installing frontend dependencies…" -ForegroundColor Cyan
Push-Location client
npm install
Pop-Location

# 8) Write the unified start.ps1 launcher
Write-Host "→ Emitting start.ps1 in project root…" -ForegroundColor Cyan
@"
# start.ps1
# Launches backend and frontend in two windows

# Start backend:
Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", "cd `"$PSScriptRoot\server`"; node server.js" `
  -WindowStyle Normal

# Start frontend:
Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", "cd `"$PSScriptRoot\client`"; npm start" `
  -WindowStyle Normal

Write-Host "`n✅ All set! Backend on http://localhost:5000, Frontend on http://localhost:3000" -ForegroundColor Green
"@ | Out-File start.ps1 -Encoding utf8

# 9) Final message
Write-Host "`n🎉 Restructure complete. Run .\start.ps1 to launch your locally self-contained FogSmartControl system!" -ForegroundColor Green
