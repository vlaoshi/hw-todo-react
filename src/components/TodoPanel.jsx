/*
  할 일(To-Do) 패널: 날짜 이동 + 입력 폼 + 필터 + 목록 + 아래쪽 안내
  기존 index.html의 "2. 할 일(To-Do) 패널 영역"이에요.
*/
import { todayStr } from "../utils/date.js";
import { filterTodos, getDayTodos } from "../utils/game.js";
import DateNav from "./DateNav.jsx";
import Filters from "./Filters.jsx";
import TodoForm from "./TodoForm.jsx";
import TodoItem from "./TodoItem.jsx";

// 목록이 비었을 때 필터에 맞는 안내 문구
function getEmptyText(filter, isPast) {
  if (filter === "active") return "남은 할 일이 없어요! 배불러요 😋";
  if (filter === "done") return "아직 완료한 일이 없어요. 하나 해치워 볼까요?";
  return isPast ? "이 날은 할 일이 없었어요." : "아직 할 일이 없어요. 첫 번째 밥(할 일)을 주세요! 🍙";
}

export default function TodoPanel({
  todos,
  selectedDate,
  filter,
  user,
  onMoveDate,
  onToday,
  onFilterChange,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onCarry,
  onCarryInfo,
  onLogout,
}) {
  const dayTodos = getDayTodos(todos, selectedDate);
  const visibleTodos = filterTodos(dayTodos, filter);
  const doneCount = dayTodos.filter((t) => t.done).length;
  const counts = { all: dayTodos.length, active: dayTodos.length - doneCount, done: doneCount };

  return (
    <section className="panel" aria-label="할 일 목록">
      <DateNav selectedDate={selectedDate} onMove={onMoveDate} onToday={onToday} />
      <TodoForm selectedDate={selectedDate} onAdd={onAdd} />
      <Filters filter={filter} counts={counts} onChange={onFilterChange} />

      <ul className="todo-list">
        {visibleTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            selectedDate={selectedDate}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onCarry={onCarry}
            onCarryInfo={onCarryInfo}
          />
        ))}
      </ul>

      {visibleTodos.length === 0 && (
        <p className="empty">{getEmptyText(filter, selectedDate < todayStr())}</p>
      )}

      <footer className="panel__footer">
        <span>✅ 완료 +20 · 🎁 마감 전 +5 · ➜ 넘기기 -5 · 🗑️ 포기 -10</span>
        <span className="user-box">
          <span>👤 {user.displayName}</span>
          <button type="button" className="link-btn" onClick={onLogout}>
            로그아웃
          </button>
        </span>
      </footer>
    </section>
  );
}
