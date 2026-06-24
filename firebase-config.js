/* ============================================================
   FIREBASE CONFIG — fill this in with YOUR project's keys.
   Get these from: Firebase Console → Project settings →
   General tab → "Your apps" → the web app (</>) you registered.
   These values are safe to be public in client-side code; your
   data is protected by Firestore Security Rules, not by hiding
   these keys. See README.md for the full setup walkthrough.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBLhwJjjhyjkvE9P93HXxZxqJqQ7wumx3U",
  authDomain: "iron-log-658ae.firebaseapp.com",
  projectId: "iron-log-658ae",
  storageBucket: "iron-log-658ae.firebasestorage.app",
  messagingSenderId: "730312443854",
  appId: "1:730312443854:web:4338c3eae61fd7bfa20d9f"
};

/* ============================================================
   ACCESS RESTRICTION
   This app is built for a single person. Only an account signed
   in with this exact email address is allowed past the login
   screen — the real enforcement is in your Firestore rules
   (which check this same address server-side), this is just
   what gives a friendly message instead of a generic error.
   Set this to YOUR email, then put the SAME address in the
   firestore.rules file before publishing those rules.
   ============================================================ */
const ALLOWED_EMAIL = "ben.whitehurst@protonmail.com";

export { ALLOWED_EMAIL };
export default firebaseConfig;
