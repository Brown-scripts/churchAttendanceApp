import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getAuth,setPersistence, browserSessionPersistence } from "firebase/auth";

// Your Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// ✅ Initialize Firebase App
const app = initializeApp(firebaseConfig);

// ✅ Initialize Firestore
const db = getFirestore(app);

// ✅ Define the collection reference
const attendanceCollection = collection(db, "attendance");

// ✅ Initialize Firebase Authentication
const auth = getAuth(app);

// 🔹 Set session persistence to last only while the tab is open
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log("Session will expire when tab is closed.");
  })
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// ✅ Export Firestore database and collection
export { db, attendanceCollection,auth };

