// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBLkYRyzdQpbbTGnxyjjVcc7dQzML4Ck94",
    authDomain: "openmicapp-8ae5f.firebaseapp.com",
    projectId: "openmicapp-8ae5f",
    storageBucket: "openmicapp-8ae5f.firebasestorage.app",
    messagingSenderId: "128578406560",
    appId: "1:128578406560:web:8e9a62da06ab734402e1c5",
    measurementId: "G-RJWEBDLKJR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
