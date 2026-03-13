import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBr8z0cyuxrZ3C-vz1WCbb3VeNMXdTrABs",
  authDomain: "wave-mvp-67d04.firebaseapp.com",
  projectId: "wave-mvp-67d04",
  storageBucket: "wave-mvp-67d04.firebasestorage.app",
  messagingSenderId: "756923910989",
  appId: "1:756923910989:web:95581b1f572b8741508504",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  collection,
  createUserWithEmailAndPassword,
  doc,
  getDoc,
  getDocs,
  onAuthStateChanged,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
};
