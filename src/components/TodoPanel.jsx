/*
  할 일(To-Do) 패널: 날짜 이동 + 입력 폼 + 필터 + 목록 + 아래쪽 안내
  기존 index.html의 "2. 할 일(To-Do) 패널 영역"이에요.
  - 미래 날짜를 보면, 그날 생길 반복 할 일을 '반복 예정' 미리보기로 목록 아래에 보여 줘요.
    (미리보기는 개수에 세지 않고, '완료' 필터에서는 숨겨요)
*/
import { todayStr } from "../utils/date.js";
import { filterTodos, getDayTodos, getRoutinePreviews } from "../utils/game.js";
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
  routines,
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
  onStopRoutine,
  onLogout,
}) {
  const dayTodos = getDayTodos(todos, selectedDate);
  const doneCount = dayTodos.filter((t) => t.done).length;
  const counts = { all: dayTodos.length, active: dayTodos.length - doneCount, done: doneCount };

  // 미래 날짜면 반복 예정 미리보기를 붙여요.
  const previews =
    selectedDate > todayStr() && filter !== "done"
      ? getRoutinePreviews(routines, todos, selectedDate)
      : [];
  const visibleTodos = [...filterTodos(dayTodos, filter), ...previews];

  // 반복 id → 반복 틀 (배지에 요일을 보여 주고, '반복 그만하기'에 써요)
  const routineById = new Map(routines.map((r) => [r.id, r]));

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
            routine={todo.routineId ? routineById.get(todo.routineId) : undefined}
            selectedDate={selectedDate}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onCarry={onCarry}
            onCarryInfo={onCarryInfo}
            onStopRoutine={onStopRoutine}
          />
        ))}
      </ul>

      {visibleTodos.length === 0 && (
        <p className="empty">{getEmptyText(filter, selectedDate < todayStr())}</p>
      )}

      <footer className="panel__footer">
        <span>✅ 완료 +20 · 🎁 마감 전 +5 · ➜ 넘기기 -5 · 🗑️ 포기 -10 · 🔁 반복은 넘기기 없음</span>
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
