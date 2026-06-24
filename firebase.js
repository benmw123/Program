/* ============================================================
   FIREBASE LAYER
   Wraps Firebase Auth + Firestore behind a small set of plain
   functions so app.js doesn't need to know the SDK details.
   Every read/write is scoped to /users/{uid}/... so each
   account only ever sees its own data (enforced again server
   -side by Firestore Security Rules — see README.md).
   ============================================================ */

import firebaseConfig from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(()=>{
  /* Multiple tabs open, or unsupported browser — app still works,
     it just won't have offline cache in that case. */
});

const googleProvider = new GoogleAuthProvider();

/* ---------------- auth ---------------- */

function watchAuth(callback){
  onAuthStateChanged(auth, callback);
}

async function signUpWithEmail(email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

async function signInWithEmail(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

async function signInWithGoogle(){
  // Popup is more reliable than redirect when running inside an
  // installed/standalone PWA on most platforms; fall back to
  // redirect if the popup is blocked.
  try{
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  }catch(err){
    if(err && (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request")){
      await signInWithRedirect(auth, googleProvider);
      return null; // result resolves after redirect back via getRedirectResult
    }
    throw err;
  }
}

async function resolveRedirectResult(){
  const result = await getRedirectResult(auth);
  return result ? result.user : null;
}

async function resetPassword(email){
  await sendPasswordResetEmail(auth, email);
}

async function signOutUser(){
  await fbSignOut(auth);
}

/* ---------------- user state doc (mesocycle position + weights) ---------------- */

function userDocRef(uid){
  return doc(db, "users", uid);
}

async function fetchUserState(uid){
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

async function saveUserState(uid, state){
  await setDoc(userDocRef(uid), state, { merge: true });
}

/* ---------------- history (one doc per finished workout) ---------------- */

function historyCollectionRef(uid){
  return collection(db, "users", uid, "history");
}

async function fetchHistory(uid){
  const q = query(historyCollectionRef(uid), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

async function addHistorySession(uid, session){
  await addDoc(historyCollectionRef(uid), session);
}

export {
  auth,
  watchAuth,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resolveRedirectResult,
  resetPassword,
  signOutUser,
  fetchUserState,
  saveUserState,
  fetchHistory,
  addHistorySession
};
