/*
  할 일 입력 폼: 지금 보고 있는 날짜에 추가돼요.
  - 입력값은 React state로 관리해요. (제어 컴포넌트)
  - "🔁 반복"을 켜면 요일을 골라 반복 할 일로 추가해요. (반복 할 일은 마감일이 없어요)
  - onAdd(text, dueDate, repeat)가 true를 돌려주면(성공) 입력칸을 비워요.
    repeat: 반복이 꺼져 있으면 null, 켜져 있으면 { days: 요일 번호 배열(0 일 ~ 6 토), endDate: 종료일 또는 null }
    반복 추가는 서버 응답을 기다려서 Promise를 돌려줄 수도 있어요.
*/
import { useState } from "react";
import { MAX_TEXT_LENGTH } from "../constants/game.js";
import { weekdayOf } from "../utils/game.js";
import DayChips from "./DayChips.jsx";

export default function TodoForm({ selectedDate, onAdd }) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState([]);
  const [endDate, setEndDate] = useState(""); // 반복 종료일 (비우면 계속 반복)
  const [saving, setSaving] = useState(false); // 반복 추가는 서버 응답을 기다리는 동안 버튼을 잠가요

  // 반복을 켜면 보고 있는 날짜의 요일을 미리 골라 둬요.
  function toggleRepeat() {
    if (!repeat && days.length === 0) setDays([weekdayOf(selectedDate)]);
    setRepeat(!repeat);
  }

  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침 막기
    if (saving) return;
    // Enter 키도 폼 제출로 처리돼요. 한글 조합 중 Enter는 브라우저가 조합을 먼저 끝내 줘요.
    setSaving(true);
    try {
      const ok = await onAdd(
        text,
        repeat ? null : dueDate || null,
        repeat ? { days, endDate: endDate || null } : null
      );
      if (ok) {
        setText("");
        setDueDate("");
        setRepeat(false);
        setDays([]);
        setEndDate("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    // noValidate: 브라우저 기본 경고 대신 다마고치가 직접 안내해요
    <form className="todo-form" autoComplete="off" noValidate onSubmit={handleSubmit}>
      <div className="todo-form__row">
        <label htmlFor="todoInput" className="sr-only">
          새 할 일
        </label>
        <input
          type="text"
          id="todoInput"
          className="todo-form__input"
          maxLength={MAX_TEXT_LENGTH}
          placeholder="할 일을 적고 밥을 주세요! 🍎"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="todo-form__btn" disabled={saving}>
          추가
        </button>
      </div>

      <div className="todo-form__row todo-form__row--sub">
        {/* 반복 켜기/끄기 */}
        <button
          type="button"
          className={`repeat-toggle${repeat ? " is-on" : ""}`}
          aria-pressed={repeat}
          onClick={toggleRepeat}
        >
          🔁 반복
        </button>

        {/* 반복 종료일 (선택): 비우면 계속 반복 */}
        {repeat && (
          <>
            <label htmlFor="repeatEndInput" className="due-label">
              📅 종료일 <small>(선택)</small>
            </label>
            <input
              type="date"
              id="repeatEndInput"
              className="due-input"
              min={selectedDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </>
        )}

        {/* 마감일 (선택): 반복 할 일에는 없어요 */}
        {!repeat && (
          <>
            <label htmlFor="dueInput" className="due-label">
              📅 마감일 <small>(선택)</small>
            </label>
            <input
              type="date"
              id="dueInput"
              className="due-input"
              min={selectedDate}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </>
        )}
      </div>

      {/* 반복 요일 고르기 */}
      {repeat && <DayChips days={days} onChange={setDays} />}
    </form>
  );
}
