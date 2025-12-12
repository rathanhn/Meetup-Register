
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "meetup-register-35fb2.firebaseapp.com",
  projectId: "meetup-register-35fb2",
  storageBucket: "meetup-register-35fb2.appspot.com",
  messagingSenderId: "977245672514",
  appId: "1:977245672514:web:07f3c9489367f83f5d09db"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (getApps().length) {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
    // For server-side rendering
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}


export { app, db, auth };
