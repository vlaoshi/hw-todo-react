/*
  다마고치 투두 - React 버전 (가장 바깥 컴포넌트)
  ---------------------------------------------------------
  로그인 상태에 따라 보여 줄 화면을 고르기만 해요.
  - 로그인 전: 흐릿한 기본 게임기 + 로그인 화면(게이트)
  - 로그인 후: 백엔드에서 내 데이터를 불러온 뒤 게임 화면(TodoApp)

  key={user.uid}: 다른 아이디로 다시 로그인하면 컴포넌트를 새로 만들어서
  이전 사용자의 할 일이 남아 보이지 않게 해요.
*/
import { useEffect, useState } from "react";
import { MESSAGES } from "./constants/messages.js";
import Device from "./components/Device.jsx";
import LoginGate from "./components/LoginGate.jsx";
import StatusGate from "./components/StatusGate.jsx";
import useAuth from "./hooks/useAuth.js";
import { getErrorMessage, withTimeout } from "./lib/auth.js";
import { loadProfile, loadRoutines, loadTodos, materializeRoutines } from "./lib/api.js";
import { todayStr } from "./utils/date.js";
import { isConnectionError, loadSnapshot, saveSnapshot } from "./lib/offline.js";
import TodoApp from "./TodoApp.jsx";

const noop = () => {};

// 안내 화면 뒤쪽이 비어 보이지 않도록 그려 두는 기본 알
// inert: 뒤쪽 화면은 클릭·키보드 이동·화면낭독기에서 모두 빠져요.
function BlankDevice() {
  return (
    <main className="app" inert>
      <Device
        xp={0}
        pendingCount={0}
        mood="normal"
        bubbleText={MESSAGES.greet[1]}
        onPet={noop}
        onTalk={noop}
      />
    </main>
  );
}

export default function App() {
  const { status, user, message, busy, submit, logout } = useAuth();

  if (status === "signedIn") {
    return <UserSession key={user.uid} user={user} onLogout={logout} />;
  }

  return (
    <>
      <BlankDevice />
      <LoginGate checking={status === "checking"} message={message} busy={busy} onSubmit={submit} />
    </>
  );
}

/*
  로그인한 사용자의 데이터 불러오기
  - 먼저 오늘의 반복 할 일을 만들어 두고(이미 있으면 그대로), 프로필·할 일·반복 목록을 동시에 불러와요.
  - 백엔드가 꺼져 있거나 CORS에 막히면 이유를 보여 주고 '다시 시도'할 수 있어요.
*/
function UserSession({ user, onLogout }) {
  const [load, setLoad] = useState({ status: "loading" }); // loading | ready | error
  const [attempt, setAttempt] = useState(0); // '다시 시도'를 누를 때마다 +1 → 다시 불러와요

  useEffect(() => {
    let cancelled = false; // 불러오는 중에 로그아웃하면 결과를 버려요

    // 인터넷이 끊겼으면: 이 기기에 기억해 둔 마지막 데이터로 '보기 전용' 시작 (없으면 오류 안내)
    const startOffline = (error) => {
      const snap = loadSnapshot(user.uid);
      if (snap) {
        setLoad({ status: "ready", profile: snap.profile, todos: snap.todos, routines: snap.routines, offline: true });
      } else {
        setLoad({ status: "error", message: getErrorMessage(error) });
      }
    };

    if (navigator.onLine === false) {
      startOffline({ code: "api/network" });
      return;
    }

    withTimeout(
      materializeRoutines(todayStr()).then(() =>
        Promise.all([loadProfile(), loadTodos(), loadRoutines()])
      )
    )
      .then(([profile, todos, routines]) => {
        if (cancelled) return;
        saveSnapshot(user.uid, { profile, todos, routines }); // 다음에 오프라인으로 열 때 보여 줄 데이터
        setLoad({ status: "ready", profile, todos, routines });
      })
      .catch((error) => {
        console.error("데이터를 불러오지 못했어요:", error.code || error);
        if (cancelled) return;
        if (isConnectionError(error)) startOffline(error);
        else setLoad({ status: "error", message: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, user.uid]);

  function retry() {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  if (load.status === "ready") {
    return (
      <TodoApp
        user={user}
        initialProfile={load.profile}
        initialTodos={load.todos}
        initialRoutines={load.routines}
        startOffline={!!load.offline}
        onLogout={onLogout}
      />
    );
  }

  return (
    <>
      <BlankDevice />
      {load.status === "loading" ? (
        <StatusGate message="다마고치를 데려오는 중… 🥚" />
      ) : (
        <StatusGate message={load.message} onRetry={retry} onLogout={onLogout} />
      )}
    </>
  );
}
