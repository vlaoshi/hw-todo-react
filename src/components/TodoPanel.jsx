/*
  할 일(To-Do) 패널: 날짜 이동 + 입력 폼 + 목록 + 완료한 일 접기
  기존 index.html의 "2. 할 일(To-Do) 패널 영역"이에요.
  - 남은 할 일만 위에 보여 주고(⭐ 중요한 일이 맨 위), 완료한 일은 아래 '완료 n개' 칸에 접어 둬요.
    (예전의 전체/진행중/완료 필터 대신이에요)
  - 미래 날짜를 보면, 그날 생길 반복 할 일을 '반복 예정' 미리보기로 남은 할 일 아래에 보여 줘요.
*/
import { useState } from "react";
import { todayStr } from "../utils/date.js";
import { getDayTodos, getRoutinePreviews, starredFirst } from "../utils/game.js";
import DateNav from "./DateNav.jsx";
import { ChevronDown, ChevronRight } from "./Icons.jsx";
import TodoForm from "./TodoForm.jsx";
import TodoItem from "./TodoItem.jsx";

export default function TodoPanel({
  tabs, // 맨 위 화면 전환 탭 (할 일 | 스케줄)
  notice, // 목록 위에 보여 줄 카드 ('지난 일 가져오기' 등, 없으면 null)
  todos,
  routines,
  selectedDate,
  onMoveDate,
  onToday,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onCarry,
  onCarryInfo,
  onStopRoutine,
  onStar,
  readOnly = false, // 오프라인(보기 전용)이면 true: 지우기·넘기기·수정 전에 막아요
  onBlocked,
}) {
  const [showDone, setShowDone] = useState(false); // '완료 n개' 칸을 펼쳤는지

  const dayTodos = getDayTodos(todos, selectedDate);
  const doneTodos = dayTodos.filter((t) => t.done);
  // 미래 날짜면 반복 예정 미리보기를 붙여요.
  const previews = selectedDate > todayStr() ? getRoutinePreviews(routines, todos, selectedDate) : [];
  // 남은 할 일: 중요한 일(⭐)이 맨 위
  const activeTodos = [...starredFirst(dayTodos.filter((t) => !t.done)), ...previews];

  // 반복 id → 반복 틀 (배지에 요일을 보여 주고, '반복 그만하기'에 써요)
  const routineById = new Map(routines.map((r) => [r.id, r]));

  return (
    <section className="panel" aria-label="할 일 목록">
      {tabs}
      <DateNav selectedDate={selectedDate} onMove={onMoveDate} onToday={onToday} />
      {notice}
      <TodoForm selectedDate={selectedDate} onAdd={onAdd} />

      <ul className="todo-list">
        {activeTodos.map((todo) => (
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
            onStar={onStar}
            readOnly={readOnly}
            onBlocked={onBlocked}
          />
        ))}
      </ul>

      {/* 처음 쓰는 사람을 위한 안내: 할 일이 적을 때만 (많아지면 이미 익숙하다고 보고 숨겨요) */}
      {activeTodos.filter((t) => !t.isPreview).length > 0 && activeTodos.filter((t) => !t.isPreview).length < 3 && (
        <p className="usage-hint">할 일을 누르면 수정 · 내일로 · 지우기가 나와요</p>
      )}

      {/* 비었을 때 안내: 다 끝낸 날과 아무것도 없는 날을 구분해요 */}
      {activeTodos.length === 0 && (
        <p className="empty">
          {doneTodos.length > 0
            ? "남은 할 일이 없어요! 배불러요 😋"
            : selectedDate < todayStr()
              ? "이 날은 할 일이 없었어요."
              : "아직 할 일이 없어요. 첫 번째 밥(할 일)을 주세요! 🍙"}
        </p>
      )}

      {/* ⑤ 완료한 일: 접어 두었다가 누르면 펼쳐요 (체크를 풀면 다시 위로 올라가요) */}
      {doneTodos.length > 0 && (
        <div className="done-section">
          <button
            type="button"
            className="done-toggle"
            aria-expanded={showDone}
            aria-controls="doneList"
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? <ChevronDown width={18} height={18} /> : <ChevronRight width={18} height={18} />}
            완료 {doneTodos.length}개
          </button>
          {showDone && (
            <ul className="todo-list done-list" id="doneList">
              {doneTodos.map((todo) => (
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
                  onStar={onStar}
                  readOnly={readOnly}
                  onBlocked={onBlocked}
                />
              ))}
            </ul>
          )}
        </div>
      )}

    </section>
  );
}
