// src/test-firebase.js
import { db, auth } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

console.log('Firebase connection test started...');

// Test authentication
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('✅ Auth connected! User:', user.email);
  } else {
    console.log('✅ Auth connected! No user signed in');
  }
});

// Test Firestore
const testFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'test'));
    console.log('✅ Firestore connected! Collections:', querySnapshot.size);
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
  }
};

testFirestore();
