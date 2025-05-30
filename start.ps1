# FogSmartControl Local Setup Script
# Save as start.ps1 in project root and run with: .\start.ps1

# Check if we're in the correct directory
if (-not (Test-Path -Path "package.json") {
    Write-Host "❌ Error: Run this script from your project root directory" -ForegroundColor Red
    exit 1
}

# Initialize variables
$backendStarted = $false
$frontendStarted = $false
$requiredFiles = @("server.js", "client\src\App.js")
$missingFiles = @()

# Check for required files
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ Missing required files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" }
    Write-Host "`nRun the following command to create the basic structure:" -ForegroundColor Yellow
    Write-Host "New-Item -ItemType Directory -Path client, server; New-Item server\server.js, client\src\App.js" -ForegroundColor Cyan
    exit 1
}

# Function to check and install dependencies
function Install-Dependencies {
    param(
        [string]$Path,
        [string]$Name
    )
    
    if (Test-Path -Path "$Path\node_modules") {
        Write-Host "✅ $Name dependencies already installed" -ForegroundColor Green
    }
    else {
        Write-Host "Installing $Name dependencies..." -ForegroundColor Yellow
        Set-Location $Path
        npm install
        Set-Location ..
    }
}

# Install backend dependencies
Install-Dependencies -Path "." -Name "Backend"

# Install frontend dependencies
Install-Dependencies -Path "client" -Name "Frontend"

# Start backend server
if (Get-Process -Name "node" -ErrorAction SilentlyContinue) {
    Write-Host "✅ Backend server is already running" -ForegroundColor Green
    $backendStarted = $true
}
else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server.js" -WindowStyle Normal
    $backendStarted = $true
    Start-Sleep -Seconds 2  # Give backend time to initialize
}

# Start frontend
if (Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*react-scripts*" }) {
    Write-Host "✅ Frontend is already running" -ForegroundColor Green
    $frontendStarted = $true
}
else {
    if ($backendStarted) {
        Set-Location client
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal
        $frontendStarted = $true
    }
}

# Final status
if ($backendStarted -and $frontendStarted) {
    Write-Host "`n✅ System running successfully!" -ForegroundColor Green
    Write-Host "   - Backend: http://localhost:5000" -ForegroundColor Cyan
    Write-Host "   - Frontend: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "`nHardware Control Tips:"
    Write-Host "1. Connect fog machine via USB/Serial" -ForegroundColor Yellow
    Write-Host "2. Update COM port in server.js (line 15)" -ForegroundColor Yellow
    Write-Host "3. Use default credentials: admin/fogcontrol" -ForegroundColor Yellow
}
else {
    Write-Host "`n⚠️ System partially started. Check the logs above for errors." -ForegroundColor Red
}