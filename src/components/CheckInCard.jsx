/*
  '지난 일 가져오기' 카드 (할 일 목록 위)
  - 예전에는 앱을 열자마자 창이 떠서 앞을 막았는데, 이제는 목록 위에 닫을 수 있는 카드로 보여 줘요.
  - 하루에 한 번, 지난 날 못 한 일이 있을 때만 나와요.
  - 기본은 모두 가져오기. '목록 보기'를 누르면 골라서 가져올 수 있어요. 1개당 XP -5 (넘기기와 같은 규칙)
  - onResolve(가져올 할 일 id 배열): 빈 배열이면 '괜찮아요' (원래 날짜에 그대로 둬요)
*/
import { useState } from "react";
import { XP_RULES } from "../constants/game.js";
import { formatShort } from "../utils/date.js";
import { ChevronDown, ChevronRight } from "./Icons.jsx";

export default function CheckInCard({ candidates, onResolve }) {
  const [showList, setShowList] = useState(false);
  // 처음에는 모두 체크된 상태로 시작해요.
  const [selected, setSelected] = useState(() => new Set(candidates.map((t) => t.id)));

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
    <section className="checkin-card" aria-labelledby="checkinCardTitle">
      <div className="checkin-card__head">
        <span className="checkin-card__icon" aria-hidden="true">
          🌅
        </span>
        <div>
          <h2 className="checkin-card__title" id="checkinCardTitle">
            지난 날 못 한 일이 {candidates.length}개 있어요
          </h2>
          <p className="checkin-card__desc">오늘로 가져올까요? 안 가져온 일은 원래 날짜에 남아요.</p>
        </div>
      </div>

      <button
        type="button"
        className="checkin-card__toggle"
        aria-expanded={showList}
        aria-controls="checkinCardList"
        onClick={() => setShowList(!showList)}
      >
        {showList ? <ChevronDown width={16} height={16} /> : <ChevronRight width={16} height={16} />}
        {showList ? "목록 접기" : "목록 보고 고르기"}
      </button>

      {showList && (
        <ul className="checkin__list" id="checkinCardList">
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
      )}

      <div className="checkin-card__actions">
        <button type="button" className="checkin-card__btn is-primary" disabled={count === 0} onClick={() => onResolve([...selected])}>
          {count === 0 ? "가져올 일을 골라 주세요" : `${count}개 가져오기 · XP ${XP_RULES.CARRY * count}`}
        </button>
        <button type="button" className="checkin-card__btn" onClick={() => onResolve([])}>
          괜찮아요
        </button>
      </div>
    </section>
  );
}
