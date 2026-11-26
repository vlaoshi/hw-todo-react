/*
  게임기 각인 창
  - 처음 열었을 때(아직 각인을 안 물어봤을 때) 한 번 보여 줘요. 프로필 메뉴의 '게임기 각인 바꾸기'로 다시 열 수 있어요.
  - 새긴 문구는 게임기 위쪽(예전 로고 자리)에 보여요. 이름이나 각오를 새기면 애착이 생겨요.
  - onSave(문구): ""이면 '안 새기기' (기본 로고), onClose: 그냥 닫기 (다시 열 때만 쓰여요)
  - 모양은 '지난 일 가져오기' 창과 같은 CSS(.checkin)를 써요.
*/
import { useEffect, useRef, useState } from "react";

export const ENGRAVING_MAX = 20; // 백엔드 Profile 모델의 maxlength와 같게

export default function EngraveModal({ initialText = "", userName, isFirst, onSave, onClose }) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef(null);

  // 창이 열리면 입력칸에 바로 커서를 둬요.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 고르기 쉬운 예시 문구
  const examples = [`${userName}의 투두`, "작심 30년!", "갓생 1일차", "오늘도 해치운다"];
  const trimmed = text.trim();

  function handleSubmit(e) {
    e.preventDefault();
    if (trimmed) onSave(trimmed);
  }

  return (
    <div className="checkin">
      <form className="checkin__card engrave" role="dialog" aria-modal="true" aria-labelledby="engraveTitle" onSubmit={handleSubmit}>
        <h2 className="checkin__title" id="engraveTitle">
          게임기에 원하는 문구를
          <br />
          각인해 드려요
        </h2>
        <p className="checkin__desc">이름이나 각오를 새겨 보세요. 게임기 위쪽에 새겨져요.</p>

        {/* 새겨질 모습 미리보기 */}
        <div className="engrave__preview" aria-hidden="true">
          <span className="engraving">{trimmed || "여기에 새겨져요"}</span>
        </div>

        <label htmlFor="engraveInput" className="sr-only">
          각인할 문구
        </label>
        <input
          id="engraveInput"
          ref={inputRef}
          type="text"
          className="engrave__input"
          maxLength={ENGRAVING_MAX}
          placeholder={`예: ${userName}의 투두`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="engrave__count">
          {text.length} / {ENGRAVING_MAX}
        </p>

        <div className="engrave__examples" role="group" aria-label="예시 문구">
          {examples.map((ex) => (
            <button key={ex} type="button" className="engrave__example" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <button type="submit" className="login-btn" disabled={!trimmed}>
          각인하기
        </button>
        {/* 처음 안내에서는 '안 새길게요'(다시 묻지 않아요), 바꾸기에서는 '닫기' */}
        {isFirst ? (
          <button type="button" className="login-btn login-btn--ghost" onClick={() => onSave("")}>
            나중에 새길게요
          </button>
        ) : (
          <>
            {initialText && (
              <button type="button" className="login-btn login-btn--ghost" onClick={() => onSave("")}>
                각인 지우기
              </button>
            )}
            <button type="button" className="login-btn login-btn--ghost" onClick={onClose}>
              닫기
            </button>
          </>
        )}
        {isFirst && <p className="checkin__note">프로필 메뉴에서 언제든 다시 새길 수 있어요</p>}
      </form>
    </div>
  );
}
