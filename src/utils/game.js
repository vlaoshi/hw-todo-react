/*
  게임 계산 도우미 함수
  - 화면(컴포넌트)과 상관없는 순수 계산만 모아 뒀어요.
  - 기존 app.js에서는 전역 state를 직접 읽었지만,
    여기서는 필요한 값(todos 등)을 인자로 받아요. 그래야 React 어디서든 쓸 수 있어요.
*/
import { STAGES, TIRED_THRESHOLD } from "../constants/game.js";
import { todayStr, addDays, daysBetween, formatShort } from "./date.js";

// 배열에서 아무거나 하나 고르기
export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 겹치지 않는 아이디 만들기
export function createId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// XP로 현재 단계 번호(0~4) 구하기: 기준 XP를 넘은 마지막 단계
export function getStageIndex(xp) {
  let index = 0;
  STAGES.forEach((stage, i) => {
    if (xp >= stage.minXp) index = i;
  });
  return index;
}

// 마감일이 지났는가? (완료하지 않았고, 마감일이 오늘보다 앞)
export function isOverdue(todo, today = todayStr()) {
  return !todo.done && !!todo.dueDate && todo.dueDate < today;
}

// 다마고치 배고픔 개수 = 오늘 못 한 일 + 마감 지난 일 (중복 없이)
export function getPendingCount(todos) {
  const today = todayStr();
  return todos.filter((todo) => !todo.done && (todo.date === today || isOverdue(todo, today)))
    .length;
}

// 다크서클 상태인가?
export function isTired(todos) {
  return getPendingCount(todos) >= TIRED_THRESHOLD;
}

// 지금 보고 있는 날짜의 할 일
// - 오늘 화면에는 '다른 날짜에 있지만 마감이 지난 할 일'도 함께 보여 줘요. (배고픔 개수와 맞추려고)
export function getDayTodos(todos, selectedDate) {
  const today = todayStr();
  return todos.filter(
    (t) =>
      t.date === selectedDate || (selectedDate === today && t.date < today && isOverdue(t, today))
  );
}

// 필터(all | active | done)에 맞는 할 일만 골라요.
export function filterTodos(todos, filter) {
  if (filter === "active") return todos.filter((t) => !t.done);
  if (filter === "done") return todos.filter((t) => t.done);
  return todos;
}

// 마감일 표시 정보: { text, cls } 또는 null
export function getDueInfo(todo, today = todayStr()) {
  if (!todo.dueDate) return null;
  const short = formatShort(todo.dueDate);
  if (todo.done) return { text: `📅 마감 ${short}`, cls: "" };

  const left = daysBetween(today, todo.dueDate); // 마감까지 남은 일수
  if (left < 0) return { text: `📅 마감 지남 (${short})`, cls: "is-over" };
  if (left === 0) return { text: `📅 오늘 마감 (D-day)`, cls: "is-soon" };
  if (left === 1) return { text: `📅 마감 ${short} (D-1)`, cls: "is-soon" };
  return { text: `📅 마감 ${short} (D-${left})`, cls: "" };
}

// 넘길 목적지: 지난 날 할 일 → 오늘, 오늘·미래 할 일 → 그다음 날
export function getCarryTarget(todo, today = todayStr()) {
  return todo.date < today ? today : addDays(todo.date, 1);
}
