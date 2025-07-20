/**
 * Firebase configuration and initialization
 * 
 * This file sets up Firebase services for the OpenMic app:
 * - Authentication: Anonymous auth for user sessions
 * - Firestore: Database for posts, comments, user profiles
 * - Storage: File storage for video uploads
 * 
 * Security: Firebase config is safe to expose in client code.
 * Actual security is handled by Firebase Security Rules (server-side).
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBLkYRyzdQpbbTGnxyjjVcc7dQzML4Ck94",
    authDomain: "openmicapp-8ae5f.firebaseapp.com",
    projectId: "openmicapp-8ae5f",
    storageBucket: "openmicapp-8ae5f.firebasestorage.app",
    messagingSenderId: "128578406560",
    appId: "1:128578406560:web:8e9a62da06ab734402e1c5",
    measurementId: "G-RJWEBDLKJR"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Export Firebase service instances
export const auth = getAuth(app);        // Authentication service
export const db = getFirestore(app);     // Firestore database
export const storage = getStorage(app);  // File storage service
