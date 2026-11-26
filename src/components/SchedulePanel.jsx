/*
  스케줄 패널: 한 달씩 일정을 아래로 스크롤하며 봐요. ◀ ▶로 이전 달·다음 달로 넘겨요.
  - 맨 위: 🔁 반복 중인 할 일 (제목을 누르면 접고 펼 수 있어요)
  - 그 아래: ◀ 2026년 11월 ▶ → 날짜 제목 → 그날의 할 일 / 마감 (지난 날짜는 흐리게)
    '반복 할 일 포함/제외' 버튼으로 바꿔요. 포함하면 오늘 이후 날짜의 반복 예정도 보여 줘요. (기본은 제외)
  - 날짜 제목을 누르면 그날의 할 일 화면으로 이동해요. (onOpenDate)
  - 예전 달로 가면 그 달 기록을 더 불러와 달라고 알려요. (onNeedDate)
  - 여기서는 보기만 해요. 체크·수정은 할 일 화면에서 해요.
  - 접기/보이기 설정은 이 브라우저에 기억해요. (개인 화면 설정이라 DB에는 저장하지 않아요)
*/
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "./Icons.jsx";
import { formatLong, formatShort, formatTime, todayStr } from "../utils/date.js";
import { formatRoutine, isRoutineEnded } from "../utils/game.js";
import { addMonths, currentMonth, formatMonth, getScheduleDays, relativeDayLabel } from "../utils/schedule.js";

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

export default function SchedulePanel({ todos, routines, tabs, onOpenDate, onNeedDate }) {
  const today = todayStr();
  const [routinesOpen, setRoutinesOpen] = usePref("tamado:schedule:routinesOpen", true);
  const [showRoutines, setShowRoutines] = usePref("tamado:schedule:showRoutines", false);
  // 종료일이 지난 반복은 '반복 중'에서 빼요.
  const activeRoutines = routines.filter((r) => !isRoutineEnded(r, today));
  const [month, setMonth] = useState(() => currentMonth(today)); // 보고 있는 달 "YYYY-MM"
  const isThisMonth = month === currentMonth(today);
  // 보는 달의 기록이 아직 없으면 더 불러와 달라고 알려요. (onNeedDate: 그 날짜부터 기록이 있게)
  useEffect(() => {
    onNeedDate?.(`${month}-01`);
  }, [month, onNeedDate]);
  const days = getScheduleDays(todos, month, today, { routines: activeRoutines, includeRoutines: showRoutines });

  return (
    <section className="panel schedule" aria-label="스케줄">
      {tabs}

      {/* 🔁 반복 중인 할 일 (접기/펴기) */}
      {activeRoutines.length > 0 && (
        <div className={`schedule-routines${routinesOpen ? "" : " is-closed"}`}>
          <button
            type="button"
            className="schedule-routines__toggle"
            aria-expanded={routinesOpen}
            aria-controls="scheduleRoutineList"
            onClick={() => setRoutinesOpen(!routinesOpen)}
          >
            <span>🔁 반복 중</span>
            <span className="schedule-routines__count">{activeRoutines.length}개</span>
            <span className="schedule-routines__arrow" aria-hidden="true">
              {routinesOpen ? "▾" : "▸"}
            </span>
          </button>
          {routinesOpen && (
            <ul className="schedule-routines__list" id="scheduleRoutineList">
              {activeRoutines.map((r) => (
                <li key={r.id} className="schedule-routines__item">
                  <span className="schedule-routines__text">{r.text}</span>
                  <span className="badge badge--repeat">{formatRoutine(r)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 반복 할 일 보이기/숨기기 */}
      {activeRoutines.length > 0 && (
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

      {/* 달 이동: ◀ 2026년 11월 ▶ (할 일 화면의 날짜 이동과 같은 모양) */}
      <div className="date-nav schedule-nav">
        <button type="button" className="date-nav__btn" aria-label="이전 달" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft />
        </button>
        <div className="date-nav__center">
          <strong className="date-nav__label" aria-live="polite">
            {formatMonth(month)}
          </strong>
          {!isThisMonth && (
            <button type="button" className="today-btn" onClick={() => setMonth(currentMonth(today))}>
              이번 달로
            </button>
          )}
        </div>
        <button type="button" className="date-nav__btn" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight />
        </button>
      </div>

      {days.length === 0 && <p className="empty">이 달에는 적어 둔 일정이 없어요 📅</p>}

      {/* 날짜 → 할 일 */}
      {days.map(({ date, items }) => (
        <div key={date} className={`schedule-day${date === today ? " is-today" : date < today ? " is-past" : ""}`}>
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
                <span className="schedule-item__text">
                  {todo.time && <span className="todo-time">{formatTime(todo.time)}</span>}
                  {todo.text}
                </span>
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
    </section>
  );
}
