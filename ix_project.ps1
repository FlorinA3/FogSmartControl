@"
# FogSmartControl Fix Script
@"
REACT_APP_FIREBASE_API_KEY="AIzaSyAtICJrw2lx45ZK6GCyz0ruKMsRSp0cvWI"
REACT_APP_FIREBASE_AUTH_DOMAIN="fogsmartcontrol.firebaseapp.com"
REACT_APP_FIREBASE_PROJECT_ID="fogsmartcontrol"
REACT_APP_FIREBASE_STORAGE_BUCKET="fogsmartcontrol.firebasestorage.app"
REACT_APP_FIREBASE_MESSAGING_SENDER_ID="202652928953"
REACT_APP_FIREBASE_APP_ID="1:202652928953:web:3678b58189880bf9070468"
REACT_APP_FIREBASE_MEASUREMENT_ID="G-SK54YWSC6R"
"@ | Out-File .env -Encoding ASCII

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
"@ | Out-File src\firebase.js -Encoding ASCII

@"
import { db, auth } from './firebase';
import { collection, getDocs } from "firebase/firestore";

console.log("Testing Firebase connection...");

auth.onAuthStateChanged(user => {
  if (user) {
    console.log("Auth OK! User:", user.email);
  } else {
    console.log("Auth OK! No user signed in");
  }
});

const testFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "test"));
    console.log("Firestore OK! Collections:", querySnapshot.size);
  } catch (error) {
    console.error("Firestore error:", error);
  }
};

testFirestore();
"@ | Out-File src\test-firebase.js -Encoding ASCII

npm install firebase@10.11.1
npm start
"@ | Out-File fix_project.ps1 -Encoding ASCII