/*
  로그인 계층 (Auth Layer)
  - 기존 app.js의 "4. 로그인 계층"을 화면 코드와 분리해서 옮겼어요.
  - 아이디 로그인: 아이디 + 비밀번호로 계정을 만들어요. (최대 20개)
  - 아이디 가입과 '계정 20개 제한'은 Firestore가 담당해요.
    백엔드도 요청마다 이 가입 명단(accounts)을 확인해요.
*/
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, increment, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase.js";

// 아이디 계정 설정
export const MAX_ACCOUNTS = 20; // 아이디 계정은 최대 20개까지 (Firestore 보안 규칙의 20과 같게!)
export const ID_PATTERN = /^[a-z0-9_]{4,12}$/; // 아이디 규칙: 영문 소문자, 숫자, _ 로 4~12자
export const MIN_PASSWORD_LENGTH = 6; // Firebase 비밀번호 최소 길이

/*
  Firebase의 비밀번호 로그인은 '이메일' 형식만 받아요.
  그래서 아이디를 "아이디@프로젝트주소" 모양의 가짜 이메일로 바꿔서 써요.
  이 주소로 메일이 가는 일은 없고, 사용자는 아이디만 알면 돼요.
*/
const ID_EMAIL_DOMAIN = "hw-todo-7efc9.firebaseapp.com";

const idToEmail = (id) => `${id}@${ID_EMAIL_DOMAIN}`;
const emailToId = (email) => String(email || "").split("@")[0];

// 이 Firebase 사용자가 아이디(이메일/비밀번호) 계정인가?
export function isIdAccount(firebaseUser) {
  return firebaseUser.providerData.some((p) => p.providerId === "password");
}

// Firebase 사용자 정보를 앱에서 쓰는 모양으로 바꿔요.
export function toAppUser(firebaseUser) {
  const isIdUser = (firebaseUser.email || "").endsWith(`@${ID_EMAIL_DOMAIN}`);
  return {
    uid: firebaseUser.uid,
    displayName: isIdUser
      ? emailToId(firebaseUser.email) // 아이디 계정은 가짜 이메일 대신 아이디만 보여 줘요
      : firebaseUser.displayName || firebaseUser.email || "이름 없음",
    isGuest: false,
  };
}

// 코드(code)가 붙은 오류 만들기 (Firebase 오류와 같은 방식으로 처리하려고)
export function appError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// 서버가 너무 오래 대답하지 않으면 기다리지 않고 오류로 처리해요.
// (데이터베이스를 아직 안 만들었거나 인터넷이 끊기면 응답 없이 계속 기다리는 경우가 있어요)
const TIMEOUT_MS = 8000;

export function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(appError("app/timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 가입 카운터 문서 위치: meta/signup  { count: 지금까지 가입한 아이디 계정 수 }
const signupCounterRef = () => doc(db, "meta", "signup");

// 지금까지 만들어진 아이디 계정 수
export async function getSignupCount() {
  const snap = await withTimeout(getDoc(signupCounterRef()));
  return snap.exists() ? snap.data().count || 0 : 0;
}

// 가입 명단에 자리 잡기: 명단 등록 + 카운터 +1 을 '한 번에(batch)' 기록해요.
// 20개가 다 찼으면 보안 규칙이 거부해서 permission-denied 오류가 나요.
async function claimAccountSlot(uid, id) {
  const batch = writeBatch(db);
  batch.set(doc(db, "accounts", uid), { username: id, createdAt: Date.now() });
  batch.set(signupCounterRef(), { count: increment(1) }, { merge: true });
  await withTimeout(batch.commit());
}

// 가입 절차 중인지 표시 (가입 도중에 onAuthStateChanged가 먼저 게임을 시작하지 않게)
let signingUp = false;
export const isSigningUp = () => signingUp;

// [계정 만들기] 아이디 + 비밀번호로 새 계정 만들기 → 만든 Firebase 사용자를 돌려줘요.
export async function signUpWithId(id, password) {
  // 1) 남은 자리를 먼저 확인해요. 꽉 찼으면 계정 자체를 만들지 않아요.
  if ((await getSignupCount()) >= MAX_ACCOUNTS) throw appError("app/full");

  signingUp = true;
  try {
    // 2) Firebase 로그인 계정 만들기
    const credential = await createUserWithEmailAndPassword(auth, idToEmail(id), password);

    // 3) 가입 명단에 자리 잡기. 실패하면(동시에 가입해서 꽉 찬 경우 등) 방금 만든 계정을 지워요.
    try {
      await claimAccountSlot(credential.user.uid, id);
    } catch (error) {
      await deleteUser(credential.user).catch(() => {});
      throw error.code === "permission-denied" ? appError("app/full") : error;
    }
    return credential.user;
  } finally {
    signingUp = false;
  }
}

// [로그인] 성공하면 onAuthStateChanged가 이어서 처리해요.
export function signInWithId(id, password) {
  return signInWithEmailAndPassword(auth, idToEmail(id), password);
}

// [로그아웃] 성공하면 onAuthStateChanged(null)이 불려요.
export function logOut() {
  return signOut(auth);
}

// 아이디 계정이 가입 명단에 있는지 확인해요.
// (가입 중 인터넷이 끊겨 명단 등록을 못 했던 계정이면 자리가 남았을 때 다시 등록해요)
export async function ensureAccountSlot(firebaseUser) {
  const snap = await withTimeout(getDoc(doc(db, "accounts", firebaseUser.uid)));
  if (snap.exists()) return true;
  try {
    await claimAccountSlot(firebaseUser.uid, emailToId(firebaseUser.email));
    return true;
  } catch (error) {
    if (error.code === "permission-denied") return false; // 자리가 없어요
    throw error;
  }
}

// 로그인·서버 오류 이유를 쉬운 한국어로 바꿔요.
export function getErrorMessage(error) {
  switch (error && error.code) {
    case "auth/operation-not-allowed":
      return "Firebase 콘솔 → Authentication → 로그인 방법에서 '이메일/비밀번호'를 사용 설정해 주세요.";
    case "auth/configuration-not-found":
      return "Firebase 콘솔 → Authentication에서 '시작하기'를 누르고 로그인 방법에서 '이메일/비밀번호'를 사용 설정해 주세요.";
    // ----- 아이디 로그인 / 계정 만들기 -----
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "아이디 또는 비밀번호가 맞지 않아요.";
    case "auth/email-already-in-use":
      return "이미 사용 중인 아이디예요. 다른 아이디를 써 주세요.";
    case "auth/weak-password":
      return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`;
    case "auth/too-many-requests":
      return "시도가 너무 많아요. 잠시 후 다시 해 주세요.";
    case "app/full":
      return `아쉽지만 계정 정원(${MAX_ACCOUNTS}개)이 모두 찼어요 😢`;
    case "app/timeout":
    case "unavailable":
      return "서버가 응답하지 않아요. 인터넷 연결과 백엔드 서버 상태를 확인해 주세요.";
    // ----- 백엔드 서버 (주소는 .env의 VITE_API_BASE, 없으면 localhost:5050) -----
    case "api/network":
      return "백엔드 서버에 연결할 수 없어요. 서버가 켜져 있는지, CORS 설정에 5173이 있는지 확인해 주세요.";
    case "api/401":
      return "로그인이 만료됐어요. 다시 로그인해 주세요.";
    case "api/403":
      return "사용할 수 없는 계정이에요. (가입 명단에 없는 계정)";
    case "api/400":
      return `서버가 요청을 거절했어요. (${(error && error.serverMessage) || "입력값 확인"})`;
    case "api/404":
      return "서버에서 할 일을 찾을 수 없어요. 새로고침해 주세요.";
    case "api/500":
      return "백엔드 서버에 오류가 생겼어요. 서버 로그를 확인해 주세요.";
    case "permission-denied":
      return "Firestore 보안 규칙에 막혔어요. 규칙을 게시했는지 확인해 주세요.";
    case "auth/network-request-failed":
      return "인터넷 연결을 확인해 주세요.";
    default:
      return `로그인에 실패했어요. (${(error && (error.code || error.message)) || "알 수 없는 오류"})`;
  }
}
