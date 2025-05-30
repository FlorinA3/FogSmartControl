# FogSmartControl Setup Script for Windows
# Save as setup_project.ps1 and run in PowerShell

Write-Host "🔍 Analyzing project structure..." -ForegroundColor Cyan

# 1. Create/update .env file
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "⚙️  Creating .env file..." -ForegroundColor Yellow
    @"
REACT_APP_FIREBASE_API_KEY="AIzaSyAtICJrw2lx45ZK6GCyz0ruKMsRSp0cvWI"
REACT_APP_FIREBASE_AUTH_DOMAIN="fogsmartcontrol.firebaseapp.com"
REACT_APP_FIREBASE_PROJECT_ID="fogsmartcontrol"
REACT_APP_FIREBASE_STORAGE_BUCKET="fogsmartcontrol.firebasestorage.app"
REACT_APP_FIREBASE_MESSAGING_SENDER_ID="202652928953"
REACT_APP_FIREBASE_APP_ID="1:202652928953:web:3678b58189880bf9070468"
REACT_APP_FIREBASE_MEASUREMENT_ID="G-SK54YWSC6R"
"@ | Out-File -FilePath $envFile -Encoding ASCII
} else {
    Write-Host "✅ .env already exists - updating Firebase values..." -ForegroundColor Green
    (Get-Content $envFile) -replace 'REACT_APP_FIREBASE_API_KEY=.*', 'REACT_APP_FIREBASE_API_KEY="AIzaSyAtICJrw2lx45ZK6GCyz0ruKMsRSp0cvWI"' `
        -replace 'REACT_APP_FIREBASE_AUTH_DOMAIN=.*', 'REACT_APP_FIREBASE_AUTH_DOMAIN="fogsmartcontrol.firebaseapp.com"' `
        -replace 'REACT_APP_FIREBASE_PROJECT_ID=.*', 'REACT_APP_FIREBASE_PROJECT_ID="fogsmartcontrol"' `
        -replace 'REACT_APP_FIREBASE_STORAGE_BUCKET=.*', 'REACT_APP_FIREBASE_STORAGE_BUCKET="fogsmartcontrol.firebasestorage.app"' `
        -replace 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID=.*', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID="202652928953"' `
        -replace 'REACT_APP_FIREBASE_APP_ID=.*', 'REACT_APP_FIREBASE_APP_ID="1:202652928953:web:3678b58189880bf9070468"' `
        -replace 'REACT_APP_FIREBASE_MEASUREMENT_ID=.*', 'REACT_APP_FIREBASE_MEASUREMENT_ID="G-SK54YWSC6R"' | Set-Content $envFile
}

# 2. Update firebase.js
$firebaseFile = "src\firebase.js"
if (Test-Path $firebaseFile)) {
    Write-Host "⚙️  Updating Firebase initialization..." -ForegroundColor Yellow
    @"
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
"@ | Out-File -FilePath $firebaseFile -Encoding ASCII
} else {
    Write-Host "⚠️  src/firebase.js not found - creating new..." -ForegroundColor Yellow
    New-Item -Path $firebaseFile -ItemType File -Force | Out-Null
    @"
// Firebase configuration file
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
"@ | Out-File -FilePath $firebaseFile -Encoding ASCII
}

# 3. Create test file
$testFile = "src\test-firebase.js"
if (-not (Test-Path $testFile)) {
    Write-Host "🧪 Creating connection test file..." -ForegroundColor Cyan
    @"
import { db, auth } from './firebase';
import { collection, getDocs } from "firebase/firestore";

console.log("Firebase connection test started...");

// Test authentication
auth.onAuthStateChanged(user => {
  if (user) {
    console.log("✅ Auth connected! User:", user.email);
  } else {
    console.log("✅ Auth connected! No user signed in");
  }
});

// Test Firestore
const testFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "test"));
    console.log("✅ Firestore connected! Collections:", querySnapshot.size);
  } catch (error) {
    console.error("❌ Firestore connection failed:", error);
  }
};

testFirestore();
"@ | Out-File -FilePath $testFile -Encoding ASCII
} else {
    Write-Host "✅ Connection test file already exists" -ForegroundColor Green
}

# 4. Install dependencies
Write-Host "📦 Installing/updating Firebase..." -ForegroundColor Cyan
npm install firebase@10.11.1

# 5. Security reminder
Write-Host "🔒 Security reminder: Update Firestore rules in Firebase Console:" -ForegroundColor Magenta
Write-Host "https://console.firebase.google.com/project/fogsmartcontrol/firestore/rules" -ForegroundColor Blue
Write-Host "Recommended rules:" -ForegroundColor Magenta
Write-Host @"
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
"@

Write-Host "🚀 Setup complete! Run your project with: npm start" -ForegroundColor Green