/*
  날짜 이동: ◀ 11월 13일 (금) · 오늘 ▶
  기존 app.js의 renderDateNav를 컴포넌트로 옮겼어요.
*/
import { daysBetween, formatLong, todayStr } from "../utils/date.js";

export default function DateNav({ selectedDate, onMove, onToday }) {
  const diff = daysBetween(todayStr(), selectedDate);
  const relative =
    { 0: "오늘", "-1": "어제", 1: "내일" }[diff] ?? (diff < 0 ? `${-diff}일 전` : `${diff}일 뒤`);

  return (
    <div className="date-nav">
      <button type="button" className="date-nav__btn" aria-label="이전 날" onClick={() => onMove(-1)}>
        ◀
      </button>
      <div className="date-nav__center">
        <strong className="date-nav__label" aria-live="polite">
          {formatLong(selectedDate)}
        </strong>
        <span className={`date-nav__rel${diff === 0 ? " is-today" : ""}`}>{relative}</span>
        {diff !== 0 && (
          <button type="button" className="today-btn" onClick={onToday}>
            오늘로 돌아가기
          </button>
        )}
      </div>
      <button type="button" className="date-nav__btn" aria-label="다음 날" onClick={() => onMove(1)}>
        ▶
      </button>
    </div>
  );
}
