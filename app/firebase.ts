import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAWo7owWvLFLcj1i9LGatdZkFgdrdvvS1k",
  authDomain: "efootball-29514.firebaseapp.com",
  projectId: "efootball-29514",
  storageBucket: "efootball-29514.firebasestorage.app",
  messagingSenderId: "692761560044",
  appId: "1:692761560044:web:3a8b22fa7801bf49ca36c9",
  measurementId: "G-3MLDC56W29"
};

// 앱이 이미 초기화되었는지 확인 (중복 방지)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 데이터베이스 내보내기
export const db = getFirestore(app);