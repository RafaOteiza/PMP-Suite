import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDSxv0oW-h2liaJfu8jdWYXzRkBLjpoCaE",
    authDomain: "pmp-suite-dev.firebaseapp.com",
    projectId: "pmp-suite-dev",
    storageBucket: "pmp-suite-dev.firebasestorage.app",
    messagingSenderId: "383041180100",
    appId: "1:383041180100:web:6a5cbf4fbd3c0405119491"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
