/*
  접속 시 '지난 일 가져오기' 창
  - 하루에 한 번, 지난 날 못 한 일이 있으면 오늘로 가져올지 물어봐요.
  - 체크한 할 일만 가져오고, 1개당 XP -5예요. (넘기기와 같은 규칙)
  - 기존 HTML 버전의 openCheckIn / updateCheckInButton을 컴포넌트로 옮겼어요. (CSS는 그대로)
  - onResolve(가져올 할 일 id 배열): 빈 배열이면 '그냥 두기'
*/
import { useEffect, useRef, useState } from "react";
import { XP_RULES } from "../constants/game.js";
import { formatShort } from "../utils/date.js";

export default function CheckInModal({ candidates, onResolve }) {
  // 처음에는 모두 체크된 상태로 시작해요.
  const [selected, setSelected] = useState(() => new Set(candidates.map((t) => t.id)));
  const bringBtnRef = useRef(null);

  // 창이 열리면 '가져오기' 버튼에 포커스를 둬요. (키보드로 바로 고를 수 있게)
  useEffect(() => {
    bringBtnRef.current?.focus();
  }, []);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = selected.size;

  return (
    <div className="checkin">
      <div className="checkin__card" role="dialog" aria-modal="true" aria-labelledby="checkinTitle">
        <div className="checkin__icon" aria-hidden="true">
          🌅
        </div>
        <h2 className="checkin__title" id="checkinTitle">
          새로운 하루예요!
        </h2>
        <p className="checkin__desc">
          지난 날 못 한 일이 {candidates.length}개 있어요. 오늘로 가져올까요?
        </p>

        <ul className="checkin__list">
          {candidates.map((todo) => (
            <li key={todo.id}>
              <label className="checkin__item">
                <input type="checkbox" checked={selected.has(todo.id)} onChange={() => toggle(todo.id)} />
                <span className="checkin__text">{todo.text}</span>
                <span className="checkin__date">
                  {formatShort(todo.date)}
                  {todo.carryCount ? ` · ↪${todo.carryCount}` : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <p className="checkin__note">가져오는 할 일 1개당 XP -5 · 안 가져온 일은 원래 날짜에 남아요</p>
        <button
          ref={bringBtnRef}
          type="button"
          className="login-btn"
          disabled={count === 0}
          onClick={() => onResolve([...selected])}
        >
          {count === 0 ? "가져올 할 일을 골라 주세요" : `${count}개 가져오기 (XP ${XP_RULES.CARRY * count})`}
        </button>
        <button type="button" className="login-btn login-btn--ghost" onClick={() => onResolve([])}>
          그냥 두기
        </button>
      </div>
    </div>
  );
}
