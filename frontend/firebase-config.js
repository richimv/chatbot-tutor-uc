// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js"; // 👈 si usarás Realtime Database

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8FjvTgPbSqbiyZ1Hb287jpsQJ39OE52E",
  authDomain: "appchatbot-d941d.firebaseapp.com",
  databaseURL: "https://appchatbot-d941d-default-rtdb.firebaseio.com",
  projectId: "appchatbot-d941d",
  storageBucket: "appchatbot-d941d.firebasestorage.app",
  messagingSenderId: "668251523829",
  appId: "1:668251523829:web:43c98b399a51d7fe7d53bc",
  measurementId: "G-Q1FJT8JG42"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app); // 👈 conexión con Realtime Database

export { db };
