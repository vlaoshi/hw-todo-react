/*
  할 일 입력 폼: 지금 보고 있는 날짜에 추가돼요.
  - 입력값은 React state로 관리해요. (제어 컴포넌트)
  - 추가가 성공했을 때만 입력칸을 비워요. (onAdd가 true를 돌려주면 성공)
*/
import { useState } from "react";
import { MAX_TEXT_LENGTH } from "../constants/game.js";

export default function TodoForm({ selectedDate, onAdd }) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침 막기
    // Enter 키도 폼 제출로 처리돼요. 한글 조합 중 Enter는 브라우저가 조합을 먼저 끝내 줘요.
    const ok = onAdd(text, dueDate || null);
    if (ok) {
      setText("");
      setDueDate("");
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
        <button type="submit" className="todo-form__btn">
          추가
        </button>
      </div>
      {/* 마감일 (선택): 비워 두면 마감일 없음 */}
      <div className="todo-form__row todo-form__row--sub">
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
      </div>
    </form>
  );
}
