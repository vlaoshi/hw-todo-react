/*
  로그인 화면 (게이트)
  - 앱을 열면 가장 먼저 보여요. 로그인하면 사라져요.
  - checking: Firebase가 로그인 상태를 확인하는 동안 버튼을 숨겨요. (CSS의 is-checking)
  - 로그인/가입 처리는 useAuth 훅이 하고, 이 컴포넌트는 입력만 받아서 넘겨요.
*/
import { useRef, useState } from "react";
import { getSignupCount, MAX_ACCOUNTS } from "../lib/auth.js";

export default function LoginGate({ checking, message, busy, onSubmit }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [slotInfo, setSlotInfo] = useState("");

  // 남은 자리 확인 요청 번호: 여러 번 눌렀을 때 마지막 요청의 결과만 보여 줘요.
  const slotRequestRef = useRef(0);

  // 계정 만들기 탭을 누르면 '남은 자리 n / 20'을 확인해요.
  async function refreshSlotInfo() {
    const requestId = ++slotRequestRef.current;
    setSlotInfo("남은 자리 확인 중…");
    try {
      const left = Math.max(0, MAX_ACCOUNTS - (await getSignupCount()));
      if (requestId !== slotRequestRef.current) return;
      setSlotInfo(
        left > 0 ? `🎟️ 남은 자리 ${left} / ${MAX_ACCOUNTS}` : `😢 정원 ${MAX_ACCOUNTS}개가 모두 찼어요`
      );
    } catch {
      if (requestId === slotRequestRef.current) setSlotInfo("");
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    if (nextMode === "signup") refreshSlotInfo();
  }

  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침 막기
    await onSubmit(mode, id, password, confirm);
    // 비밀번호는 화면에 남겨 두지 않아요. (성공하면 이 화면이 사라지고, 실패하면 다시 입력)
    setPassword("");
    setConfirm("");
  }

  return (
    <div className={`login-gate${checking ? " is-checking" : ""}`}>
      <div className="login-card" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
        <div className="login-card__egg" aria-hidden="true">
          🥚
        </div>
        <h1 className="login-card__title" id="loginTitle">
          TAMA-DO
        </h1>
        <p className="login-card__desc">
          할 일을 완료하면 다마고치가 자라요!
          <br />
          로그인하면 어느 기기에서든 이어서 키울 수 있어요.
        </p>

        {/* data-mode="signup"이면 CSS가 signup-only 칸(비밀번호 확인, 남은 자리)을 보여 줘요 */}
        <form className="id-form" data-mode={mode} noValidate onSubmit={handleSubmit}>
          <div className="id-tabs" role="tablist" aria-label="로그인 방식">
            {[
              ["login", "로그인"],
              ["signup", "계정 만들기"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`id-tab${mode === key ? " is-active" : ""}`}
                role="tab"
                aria-selected={mode === key}
                disabled={busy}
                onClick={() => changeMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="idInput">
            아이디
          </label>
          <input
            type="text"
            id="idInput"
            className="id-input"
            placeholder="아이디 (영문 소문자·숫자·_ 4~12자)"
            maxLength={12}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />

          <label className="sr-only" htmlFor="pwInput">
            비밀번호
          </label>
          <input
            type="password"
            id="pwInput"
            className="id-input"
            placeholder="비밀번호 (6자 이상)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="sr-only signup-only" htmlFor="pwConfirmInput">
            비밀번호 확인
          </label>
          <input
            type="password"
            id="pwConfirmInput"
            className="id-input signup-only"
            placeholder="비밀번호 확인"
            autoComplete="new-password"
            disabled={busy}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <p className="slot-info signup-only">{slotInfo}</p>

          <button type="submit" className="login-btn" disabled={busy}>
            {mode === "signup" ? "계정 만들기" : "로그인"}
          </button>
        </form>

        <p className="login-card__msg" role="status">
          {checking ? "로그인 확인 중…" : message}
        </p>
      </div>
    </div>
  );
}
