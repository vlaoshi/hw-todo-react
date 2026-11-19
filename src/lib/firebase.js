/*
  Firebase 연결
  - 기존 app.js는 gstatic CDN 주소에서 불러왔지만, React(Vite)에서는 npm 패키지(firebase)로 불러와요.
  - apiKey는 원래 웹페이지에 공개되는 값이라 코드에 있어도 괜찮아요.
    '누가 어떤 데이터를 읽고 쓸 수 있는지'는 Firestore 보안 규칙과 백엔드의 토큰 검사가 막아요.
  - 방문 통계(Google Analytics)는 개인정보 보호를 위해 일부러 켜지 않았어요.
*/
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 내 Firebase 프로젝트 연결 정보 (기존 app.js와 같아요)
const firebaseConfig = {
  apiKey: "AIzaSyDKv5yBZIfs0CCkufgIBnqnJ94vyOOaKEY",
  authDomain: "hw-todo-7efc9.firebaseapp.com",
  projectId: "hw-todo-7efc9",
  storageBucket: "hw-todo-7efc9.firebasestorage.app",
  messagingSenderId: "582599341606",
  appId: "1:582599341606:web:9c2588e1ea90676fca98e7",
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp); // 로그인(Authentication)
export const db = getFirestore(firebaseApp); // 가입 명단·가입 카운터(Firestore)
