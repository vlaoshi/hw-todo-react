/*
  할 일 한 줄
  - 기존 app.js의 createTodoElement(그리기) + startEdit(수정 모드)를 합쳤어요.
  - 사용자가 쓴 글자는 JSX에 {todo.text}로 넣어요. React가 알아서 글자로만 넣어 줘서
    <script> 같은 코드가 실행될 걱정이 없어요. (기존의 textContent와 같은 효과)
*/
import { useEffect, useRef, useState } from "react";
import { CARRY_NAG_COUNT, MAX_TEXT_LENGTH, XP_RULES } from "../constants/game.js";
import { formatShort, todayStr } from "../utils/date.js";
import { getCarryTarget, getDueInfo } from "../utils/game.js";

// 사라지는 애니메이션(CSS) 시간과 맞춰요.
const REMOVE_ANIMATION_MS = 280;

export default function TodoItem({ todo, selectedDate, onToggle, onDelete, onEdit, onCarry, onCarryInfo }) {
  const today = todayStr();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  // 사라지는 애니메이션을 보여 준 뒤 실제 동작을 해요. (빠르게 두 번 눌러도 한 번만)
  function removeThen(action) {
    if (removing) return;
    setRemoving(true);
    setTimeout(action, REMOVE_ANIMATION_MS);
  }

  function handleCarry() {
    // 넘긴 뒤 지금 보는 날짜에서 사라지면 휙 사라지는 애니메이션을 보여 줘요.
    const leavesView = getCarryTarget(todo, today) !== selectedDate;
    if (leavesView) removeThen(() => onCarry(todo.id));
    else onCarry(todo.id);
  }

  const due = getDueInfo(todo, today);
  const carryText = todo.carryCount === 1 ? "↪ 넘어옴" : `↪ ${todo.carryCount}번째`;
  const toToday = todo.date < today;

  const className = [
    "todo-item",
    todo.done && "is-done",
    editing && "is-editing",
    removing && "is-removing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={className}>
      <label className="todo-check">
        <input
          type="checkbox"
          className="todo-check__input"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          aria-label={`${todo.text} ${todo.done ? "완료 해제" : "완료"}`}
        />
        <span className="todo-check__box" aria-hidden="true" />
      </label>

      {editing ? (
        <EditForm
          todo={todo}
          onFinish={(changes) => {
            setEditing(false);
            if (changes) onEdit(todo.id, changes);
          }}
        />
      ) : (
        <div className="todo-main">
          <span className="todo-text" title="더블클릭해서 수정" onDoubleClick={() => setEditing(true)}>
            {todo.text}
          </span>
          <div className="todo-meta">
            {/* ↪ 넘어온 표식 (누르면 처음 날짜를 알려 줘요) */}
            {todo.carryCount > 0 && (
              <button
                type="button"
                className={`badge badge--carry${todo.carryCount >= CARRY_NAG_COUNT ? " is-nag" : ""}`}
                aria-label={`${carryText}, 처음 날짜 보기`}
                onClick={() => onCarryInfo(todo)}
              >
                {carryText}
              </button>
            )}

            {/* 오늘 화면에 보이는 '다른 날의 마감 지난 일'에는 원래 날짜 표시 */}
            {todo.date !== selectedDate && (
              <span className="badge badge--from">🗓️ {formatShort(todo.date)}의 할 일</span>
            )}

            {/* 📅 마감일 */}
            {due && <span className={`badge badge--due ${due.cls}`}>{due.text}</span>}

            {/* 내일로 / 오늘로 버튼 (못 한 일에만) */}
            {!todo.done && (
              <button
                type="button"
                className="carry-btn"
                title={`${toToday ? "오늘로" : "다음 날로"} 넘기기 (XP ${XP_RULES.CARRY})`}
                onClick={handleCarry}
              >
                {toToday ? "오늘로 ➜" : "내일로 ➜"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="todo-actions">
        <button type="button" className="icon-btn" aria-label="수정" onClick={() => setEditing(true)}>
          ✏️
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          aria-label="삭제"
          onClick={() => removeThen(() => onDelete(todo.id))}
        >
          🗑️
        </button>
      </div>
    </li>
  );
}

/*
  수정 모드: 글자 입력칸 + 마감일 입력칸
  - Enter: 저장 / Esc: 취소 / 이 할 일 밖으로 포커스가 나가면 저장
  - onFinish(changes): 바뀐 게 있으면 { text, dueDate }, 없거나 취소면 null
*/
function EditForm({ todo, onFinish }) {
  const [text, setText] = useState(todo.text);
  const [dueDate, setDueDate] = useState(todo.dueDate || "");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const finishedRef = useRef(false); // Enter와 포커스 이동이 동시에 일어나도 한 번만 처리

  // 수정 모드가 열리면 글자 입력칸에 바로 커서를 둬요.
  useEffect(() => {
    inputRef.current.focus();
    inputRef.current.select();
  }, []);

  function finish(save) {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (!save) return onFinish(null);
    const newText = text.trim().slice(0, MAX_TEXT_LENGTH);
    const newDue = dueDate || null;
    const textChanged = !!newText && newText !== todo.text;
    const dueChanged = newDue !== (todo.dueDate || null);
    if (!textChanged && !dueChanged) return onFinish(null);
    onFinish({ text: textChanged ? newText : todo.text, dueDate: newDue });
  }

  function handleKeyDown(e) {
    // 한글 조합 중 Enter는 무시해요. (조합이 끝난 뒤 다시 누른 Enter로 저장)
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      finish(true);
    }
    if (e.key === "Escape") finish(false);
  }

  // 글자칸 ↔ 마감일칸 사이 이동은 괜찮고, 이 할 일 밖으로 포커스가 나가면 저장해요.
  // (날짜 선택 달력이 열릴 때 잠깐 포커스가 흔들리는 경우가 있어서 0.15초 뒤에 다시 확인해요)
  function handleBlur() {
    setTimeout(() => {
      if (wrapRef.current && !wrapRef.current.contains(document.activeElement)) finish(true);
    }, 150);
  }

  return (
    <div className="todo-main" ref={wrapRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <input
        ref={inputRef}
        type="text"
        className="todo-edit"
        value={text}
        maxLength={MAX_TEXT_LENGTH}
        aria-label="할 일 수정"
        onChange={(e) => setText(e.target.value)}
      />
      <label className="todo-edit-due">
        <span>📅 마감일</span>
        <input
          type="date"
          className="due-input"
          value={dueDate}
          min={todo.date}
          aria-label="마감일 수정 (비우면 없음)"
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>
    </div>
  );
}
