#!/bin/bash
# FogSmartControl Automated Setup Script
# Run from project root directory

set -e  # Exit immediately on error

echo "🔍 Analyzing project structure..."

# 1. Create/update .env file (preserve existing variables)
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cat > .env <<EOL
REACT_APP_FIREBASE_API_KEY="AIzaSyAtICJrw2lx45ZK6GCyz0ruKMsRSp0cvWI"
REACT_APP_FIREBASE_AUTH_DOMAIN="fogsmartcontrol.firebaseapp.com"
REACT_APP_FIREBASE_PROJECT_ID="fogsmartcontrol"
REACT_APP_FIREBASE_STORAGE_BUCKET="fogsmartcontrol.firebasestorage.app"
REACT_APP_FIREBASE_MESSAGING_SENDER_ID="202652928953"
REACT_APP_FIREBASE_APP_ID="1:202652928953:web:3678b58189880bf9070468"
REACT_APP_FIREBASE_MEASUREMENT_ID="G-SK54YWSC6R"
EOL
else
    echo "✅ .env already exists - updating Firebase values only..."
    # Update only Firebase-related variables
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_API_KEY=).*|\1\"AIzaSyAtICJrw2lx45ZK6GCyz0ruKMsRSp0cvWI\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_AUTH_DOMAIN=).*|\1\"fogsmartcontrol.firebaseapp.com\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_PROJECT_ID=).*|\1\"fogsmartcontrol\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_STORAGE_BUCKET=).*|\1\"fogsmartcontrol.firebasestorage.app\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_MESSAGING_SENDER_ID=).*|\1\"202652928953\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_APP_ID=).*|\1\"1:202652928953:web:3678b58189880bf9070468\"|" .env
    sed -i.bak -E "s|^(REACT_APP_FIREBASE_MEASUREMENT_ID=).*|\1\"G-SK54YWSC6R\"|" .env
    rm .env.bak  # Remove backup
fi

# 2. Update firebase.js only if it exists
if [ -f "src/firebase.js" ]; then
    echo "⚙️  Updating Firebase initialization..."
    cat > src/firebase.js <<EOL
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
EOL
else
    echo "⚠️  src/firebase.js not found - skipping update"
fi

# 3. Create test file only if it doesn't exist
TEST_FILE="src/test-firebase.js"
if [ ! -f "$TEST_FILE" ]; then
    echo "🧪 Creating connection test file..."
    cat > "$TEST_FILE" <<EOL
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
EOL
else
    echo "✅ Connection test file already exists"
fi

# 4. Install required packages only if needed
echo "📦 Checking dependencies..."
if ! npm list firebase@10.11.1 | grep -q "firebase@10.11.1"; then
    echo "⬇️  Installing Firebase v10.11.1..."
    npm install firebase@10.11.1
else
    echo "✅ Firebase v10.11.1 already installed"
fi

# 5. Security rules (Firestore console only)
echo "🔒 Security reminder: Update Firestore rules in Firebase Console:"
echo "https://console.firebase.google.com/project/fogsmartcontrol/firestore/rules"
echo "Recommended rules:"
cat <<EOL
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
EOL

echo "🚀 Setup complete! Run your project with:"
echo "npm start"