/*
  할 일 입력 폼: 지금 보고 있는 날짜에 추가돼요.
  - 입력값은 React state로 관리해요. (제어 컴포넌트)
  - 평소엔 글자 입력칸만 보이고, 칸 안의 아이콘을 누르면 옵션이 펼쳐져요. (메인 화면 개선안 ④)
      📅 마감일 정하기   /   🔁 반복 (요일 + 반복 종료일, 반복 할 일은 마감일이 없어요)
  - onAdd(text, dueDate, repeat)가 true를 돌려주면(성공) 입력칸을 비워요.
    repeat: 반복이 꺼져 있으면 null, 켜져 있으면 { days: 요일 번호 배열(0 일 ~ 6 토), endDate: 종료일 또는 null }
    반복 추가는 서버 응답을 기다려서 Promise를 돌려줄 수도 있어요.
*/
import { useState } from "react";
import { MAX_TEXT_LENGTH } from "../constants/game.js";
import { formatShort } from "../utils/date.js";
import { weekdayOf } from "../utils/game.js";
import DayChips from "./DayChips.jsx";
import { CalendarIcon, RepeatIcon } from "./Icons.jsx";

export default function TodoForm({ selectedDate, onAdd }) {
  const [text, setText] = useState("");
  const [dueOpen, setDueOpen] = useState(false); // 마감일 칸을 펼쳤는지
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState([]);
  const [endDate, setEndDate] = useState(""); // 반복 종료일 (비우면 계속 반복)
  const [saving, setSaving] = useState(false); // 반복 추가는 서버 응답을 기다리는 동안 버튼을 잠가요

  // 📅 누르기: 마감일 칸 열고 닫기 (반복과 함께 쓰지 않아요)
  function toggleDue() {
    setDueOpen(!dueOpen);
    setRepeat(false);
  }

  // 🔁 누르기: 반복 열고 닫기. 처음 켤 때는 보고 있는 날짜의 요일을 미리 골라 둬요.
  function toggleRepeat() {
    if (!repeat && days.length === 0) setDays([weekdayOf(selectedDate)]);
    setRepeat(!repeat);
    setDueOpen(false);
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
        setDueOpen(false);
        setDueDate("");
        setRepeat(false);
        setDays([]);
        setEndDate("");
      }
    } finally {
      setSaving(false);
    }
  }

  const hasDue = !repeat && !!dueDate;

  return (
    // noValidate: 브라우저 기본 경고 대신 다마고치가 직접 안내해요
    <form className="todo-form" autoComplete="off" noValidate onSubmit={handleSubmit}>
      <div className="todo-form__row">
        <div className="input-shell">
          <label htmlFor="todoInput" className="sr-only">
            새 할 일
          </label>
          <input
            type="text"
            id="todoInput"
            className="todo-form__input"
            maxLength={MAX_TEXT_LENGTH}
            placeholder="할 일을 적어 주세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {/* 마감일을 정해 두면 아이콘 옆에 날짜가 작게 보여요 */}
          {hasDue && !dueOpen && <span className="input-shell__hint">{formatShort(dueDate)}</span>}
          <button
            type="button"
            className={`shell-btn${dueOpen || hasDue ? " is-on" : ""}`}
            aria-label="마감일 정하기"
            aria-pressed={dueOpen}
            aria-controls="dueOption"
            onClick={toggleDue}
          >
            <CalendarIcon />
          </button>
          <button
            type="button"
            className={`shell-btn shell-btn--repeat${repeat ? " is-on" : ""}`}
            aria-label="반복 설정"
            aria-pressed={repeat}
            aria-controls="repeatOption"
            onClick={toggleRepeat}
          >
            <RepeatIcon />
          </button>
        </div>
        <button type="submit" className="todo-form__btn" disabled={saving}>
          추가
        </button>
      </div>

      {/* 📅 마감일 (선택) */}
      {dueOpen && !repeat && (
        <div className="form-option" id="dueOption">
          <label htmlFor="dueInput" className="due-label">
            마감일
          </label>
          <input
            type="date"
            id="dueInput"
            className="due-input"
            min={selectedDate}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {dueDate && (
            <button type="button" className="option-clear" onClick={() => setDueDate("")}>
              지우기
            </button>
          )}
        </div>
      )}

      {/* 🔁 반복: 요일 + 반복 종료일(선택, 비우면 계속 반복) */}
      {repeat && (
        <div className="form-option form-option--repeat" id="repeatOption">
          <DayChips days={days} onChange={setDays} />
          <div className="form-option__row">
            <label htmlFor="repeatEndInput" className="due-label">
              반복 종료일 <small>(선택)</small>
            </label>
            <input
              type="date"
              id="repeatEndInput"
              className="due-input"
              min={selectedDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}
    </form>
  );
}
