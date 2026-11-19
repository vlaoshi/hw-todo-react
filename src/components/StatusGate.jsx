/*
  상태 안내 화면 (로그인 화면과 같은 모양의 카드)
  - 로그인 후 데이터를 불러오는 중이거나, 불러오기에 실패했을 때 보여 줘요.
  - onRetry / onLogout을 넘기면 버튼이 나타나요.
*/
export default function StatusGate({ message, onRetry, onLogout }) {
  return (
    <div className="login-gate">
      <div className="login-card" role="dialog" aria-modal="true" aria-labelledby="statusTitle">
        <div className="login-card__egg" aria-hidden="true">
          🥚
        </div>
        <h1 className="login-card__title" id="statusTitle">
          TAMA-DO
        </h1>
        {onRetry && (
          <button type="button" className="login-btn" onClick={onRetry}>
            다시 시도
          </button>
        )}
        {onLogout && (
          <button type="button" className="login-btn login-btn--ghost" onClick={onLogout}>
            로그아웃
          </button>
        )}
        <p className="login-card__msg" role="status">
          {message}
        </p>
      </div>
    </div>
  );
}
