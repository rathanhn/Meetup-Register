
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJYhvREwAe0z3e_UNdryRH9biZPN8igLQ",
  authDomain: "meetup-register-35fb2.firebaseapp.com",
  projectId: "meetup-register-35fb2",
  storageBucket: "meetup-register-35fb2.appspot.com",
  messagingSenderId: "977245672514",
  appId: "1:977245672514:web:07f3c9489367f83f5d09db"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
