import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// Đây là đoạn bạn thay vào từ Firebase Console của bạn
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "epistheme-2ee89.firebaseapp.com",
  projectId: "epistheme-2ee89",
  storageBucket: "epistheme-2ee89.firebasestorage.app",
  messagingSenderId: "877510756961",
  appId: "1:877510756961:web:9b44632643294491a03820",
  measurementId: "G-F60233BEDV"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các dịch vụ để dùng ở file script.js
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();