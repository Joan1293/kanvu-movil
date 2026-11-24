import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4SDvpZ3E9ovRUdjcAOLXJtLmaAbgVN1M",
  authDomain: "kanvu-82c44.firebaseapp.com",
  projectId: "kanvu-82c44",
  storageBucket: "kanvu-82c44.firebasestorage.app",
  messagingSenderId: "522648853487",
  appId: "1:522648853487:web:71e5de32b854bb3254b41a",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);