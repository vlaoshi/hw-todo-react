/*
  로그인 상태 관리 훅 (useAuth)
  - 기존 app.js의 "14. 앱 시작 & 로그인 화면" 흐름을 React 훅으로 옮겼어요.

  흐름
  1) 앱이 열리면 status = "checking" (로그인 화면이 "확인 중…"으로 떠요)
  2) Firebase가 "이미 로그인한 사람인지" 알려 줘요. (onAuthStateChanged)
     - 로그인되어 있으면 → 가입 명단 확인 후 status = "signedIn"
     - 아니면 → status = "signedOut" (아이디 로그인 / 계정 만들기 화면)
  3) 로그아웃하면 다시 "signedOut"으로 돌아가요.

  돌려주는 값
    status   "checking" | "signedOut" | "signedIn"
    user     { uid, displayName, isGuest } 또는 null
    message  로그인 화면에 보여 줄 안내 문구
    busy     로그인 처리 중이면 true (버튼을 잠시 못 누르게)
    submit(mode, id, password, confirm)  로그인 또는 계정 만들기
    logout()
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import {
  appError,
  ensureAccountSlot,
  getErrorMessage,
  ID_PATTERN,
  isIdAccount,
  isSigningUp,
  logOut,
  MIN_PASSWORD_LENGTH,
  signInWithId,
  signUpWithId,
  toAppUser,
} from "../lib/auth.js";

export default function useAuth() {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // 같은 사용자를 두 번 처리하지 않도록 표시 (화면을 다시 그려도 값이 유지되게 ref 사용)
  const handlingUidRef = useRef(null);
  const userRef = useRef(null);

  // 로그인 화면으로 돌아가기
  const showGate = useCallback((text = "") => {
    userRef.current = null;
    setUser(null);
    setStatus("signedOut");
    setMessage(text);
    setBusy(false);
  }, []);

  // Firebase에 로그인된 사용자를 확인하고 게임 시작
  // (아이디 계정이면 가입 명단에 있는지 먼저 확인해요)
  const startWithFirebaseUser = useCallback(
    async (firebaseUser) => {
      const uid = firebaseUser.uid;
      if (userRef.current?.uid === uid || handlingUidRef.current === uid) return;
      handlingUidRef.current = uid;
      setBusy(true);
      setMessage("계정을 확인하는 중… 🥚");
      try {
        // 이 앱은 아이디 계정만 써요. 다른 방식(예: 예전에 쓰던 Google 로그인)이면 로그아웃시켜요.
        if (!isIdAccount(firebaseUser)) {
          await logOut();
          showGate("아이디로 다시 로그인해 주세요.");
          return;
        }
        if (!(await ensureAccountSlot(firebaseUser))) {
          await logOut();
          showGate(getErrorMessage(appError("app/full")));
          return;
        }
        const appUser = toAppUser(firebaseUser);
        userRef.current = appUser;
        setUser(appUser);
        setStatus("signedIn");
        setMessage("");
        setBusy(false);
      } catch (error) {
        console.error("계정 확인 실패:", error.code || error);
        showGate(getErrorMessage(error));
      } finally {
        handlingUidRef.current = null;
      }
    },
    [showGate]
  );

  // Firebase가 로그인 상태를 알려 줄 때마다 실행돼요. (앱을 열 때 1번 + 로그인/로그아웃할 때마다)
  // 컴포넌트가 사라지면 구독을 끊어요. (onAuthStateChanged가 돌려주는 함수가 구독 해제 함수예요)
  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // 계정 만들기 도중이면 가입 절차가 끝난 뒤 submit에서 직접 처리해요.
        if (!isSigningUp()) startWithFirebaseUser(firebaseUser);
      } else if (userRef.current) {
        showGate("로그아웃했어요. 또 만나요! 👋"); // 게임 중에 로그아웃함
      } else {
        showGate(); // 앱을 처음 열었는데 로그인 안 된 상태
      }
    });
  }, [startWithFirebaseUser, showGate]);

  // [로그인] 또는 [계정 만들기]
  async function submit(mode, rawId, password, confirm) {
    const id = rawId.trim().toLowerCase();

    // 입력값 검사
    if (!ID_PATTERN.test(id)) return setMessage("아이디는 영문 소문자, 숫자, _ 로 4~12자여야 해요.");
    if (password.length < MIN_PASSWORD_LENGTH)
      return setMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
    if (mode === "signup" && password !== confirm) return setMessage("비밀번호 확인이 일치하지 않아요.");

    setBusy(true);
    setMessage(mode === "signup" ? "계정을 만드는 중… 🥚" : "로그인 중…");
    try {
      if (mode === "signup") {
        const firebaseUser = await signUpWithId(id, password);
        await startWithFirebaseUser(firebaseUser); // 가입이 끝났으니 직접 게임 시작
      } else {
        await signInWithId(id, password); // 성공하면 onAuthStateChanged가 이어서 처리해요
      }
    } catch (error) {
      console.warn("아이디 로그인/가입 실패:", error.code || error);
      setMessage(getErrorMessage(error));
      setBusy(false);
    }
  }

  // [로그아웃] 성공하면 onAuthStateChanged(null)이 로그인 화면으로 보내요.
  async function logout() {
    try {
      await logOut();
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  }

  return { status, user, message, busy, submit, logout };
}
