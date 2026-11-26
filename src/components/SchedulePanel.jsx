/*
  스케줄 패널: 앞으로의 일정을 월 단위로 한 페이지에서 아래로 쭉 스크롤하며 봐요.
  - 맨 위: 🔁 반복 중인 할 일 (제목을 누르면 접고 펼 수 있어요)
  - 그 아래: 월 제목 → 날짜 제목 → 그날의 할 일 / 마감
    '반복 할 일 포함/제외' 버튼으로 바꿔요. 포함하면 앞으로 4주 동안의 반복 예정도 보여 줘요. (기본은 제외)
  - 날짜 제목을 누르면 그날의 할 일 화면으로 이동해요. (onOpenDate)
  - 여기서는 보기만 해요. 체크·수정은 할 일 화면에서 해요.
  - 접기/보이기 설정은 이 브라우저에 기억해요. (개인 화면 설정이라 DB에는 저장하지 않아요)
*/
import { useState } from "react";
import { formatLong, formatShort, todayStr } from "../utils/date.js";
import { formatDays } from "../utils/game.js";
import { getScheduleMonths, relativeDayLabel } from "../utils/schedule.js";

// 이 브라우저에 기억하는 켜기/끄기 설정 (시크릿 모드 등으로 저장소를 못 쓰면 기본값으로 동작해요)
function usePref(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? defaultValue : saved === "1";
    } catch {
      return defaultValue;
    }
  });
  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* 저장 못 해도 지금 화면에서는 동작해요 */
    }
  };
  return [value, update];
}

export default function SchedulePanel({ todos, routines, tabs, onOpenDate }) {
  const today = todayStr();
  const [routinesOpen, setRoutinesOpen] = usePref("tamado:schedule:routinesOpen", true);
  const [showRoutines, setShowRoutines] = usePref("tamado:schedule:showRoutines", false);
  const months = getScheduleMonths(todos, today, { routines, includeRoutines: showRoutines });

  return (
    <section className="panel schedule" aria-label="스케줄">
      {tabs}

      {/* 🔁 반복 중인 할 일 (접기/펴기) */}
      {routines.length > 0 && (
        <div className={`schedule-routines${routinesOpen ? "" : " is-closed"}`}>
          <button
            type="button"
            className="schedule-routines__toggle"
            aria-expanded={routinesOpen}
            aria-controls="scheduleRoutineList"
            onClick={() => setRoutinesOpen(!routinesOpen)}
          >
            <span>🔁 반복 중</span>
            <span className="schedule-routines__count">{routines.length}개</span>
            <span className="schedule-routines__arrow" aria-hidden="true">
              {routinesOpen ? "▾" : "▸"}
            </span>
          </button>
          {routinesOpen && (
            <ul className="schedule-routines__list" id="scheduleRoutineList">
              {routines.map((r) => (
                <li key={r.id} className="schedule-routines__item">
                  <span className="schedule-routines__text">{r.text}</span>
                  <span className="badge badge--repeat">{formatDays(r.days)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 반복 할 일 보이기/숨기기 */}
      {routines.length > 0 && (
        <div className="schedule-options">
          <button
            type="button"
            className={`repeat-toggle${showRoutines ? " is-on" : ""}`}
            aria-pressed={showRoutines}
            onClick={() => setShowRoutines(!showRoutines)}
          >
            {showRoutines ? "🔁 반복 할 일 포함" : "🔁 반복 할 일 제외"}
          </button>
        </div>
      )}

      {months.length === 0 && (
        <p className="empty">앞으로 적어 둔 일정이 없어요. 할 일 화면에서 ▶로 미래 날짜에 추가해 보세요! 📅</p>
      )}

      {/* 월 → 날짜 → 할 일 */}
      {months.map(({ month, label, days }) => (
        <div key={month} className="schedule-month">
          <h3 className="schedule-month__title">{label}</h3>

          {days.map(({ date, items }) => (
            <div key={date} className={`schedule-day${date === today ? " is-today" : ""}`}>
              <button
                type="button"
                className="schedule-day__head"
                onClick={() => onOpenDate(date)}
                aria-label={`${formatLong(date)} 할 일 화면으로 이동`}
              >
                <span className="schedule-day__date">{formatLong(date)}</span>
                <span className="schedule-day__rel">{relativeDayLabel(date, today)}</span>
                <span className="schedule-day__go" aria-hidden="true">
                  ›
                </span>
              </button>

              <ul className="schedule-day__list">
                {items.map(({ kind, todo }) => (
                  <li
                    key={`${kind}-${todo.id}`}
                    className={[
                      "schedule-item",
                      todo.done && "is-done",
                      kind === "due" && "is-due",
                      todo.isPreview && "is-preview",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="schedule-item__mark" aria-hidden="true">
                      {kind === "due" ? "⏰" : todo.done ? "✅" : todo.starred ? "⭐" : todo.routineId ? "🔁" : "▫️"}
                    </span>
                    <span className="schedule-item__text">{todo.text}</span>
                    {kind === "due" && <span className="badge badge--due is-soon">마감</span>}
                    {todo.isPreview && <span className="badge badge--repeat">반복 예정</span>}
                    {kind === "plan" && todo.dueDate && !todo.done && todo.dueDate !== todo.date && (
                      <span className="badge badge--due">마감 {formatShort(todo.dueDate)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
