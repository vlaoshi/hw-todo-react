/*
  게임 계산 도우미 함수
  - 화면(컴포넌트)과 상관없는 순수 계산만 모아 뒀어요.
  - 기존 app.js에서는 전역 state를 직접 읽었지만,
    여기서는 필요한 값(todos 등)을 인자로 받아요. 그래야 React 어디서든 쓸 수 있어요.
*/
import { ABSENCE_DAYS, EVENING_HOUR, STAGES } from "../constants/game.js";
import { todayStr, addDays, daysBetween, formatShort, fromDateStr } from "./date.js";

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

// XP 게이지 정보: 현재 단계 시작점 ~ 다음 단계 시작점 사이에서 얼마나 왔는지
// (게임기와 미니 다마고치가 같이 써요)
export function getXpProgress(xp) {
  const stageIndex = getStageIndex(xp);
  const stage = STAGES[stageIndex];
  const next = STAGES[stageIndex + 1];
  const percent = next ? ((xp - stage.minXp) / (next.minXp - stage.minXp)) * 100 : 100;
  return {
    stageIndex,
    stage,
    percent,
    width: `${Math.min(100, Math.max(0, percent))}%`,
    text: next ? `${xp} / ${next.minXp} XP` : `${xp} XP MAX`,
  };
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

/*
  다마고치가 피곤한 이유 (없으면 null)
  - 할 일이 많다고 지치지 않아요. 할 일은 '먹을 밥'이니까요!
  - 대신 '방치'됐을 때만 피곤해해요. (우선순위 순)
    absence : 오랜만에 접속했어요 (첫 완료를 하면 회복)
    overdue : 마감이 지났는데 아직 못 한 일이 있어요
    evening : 저녁 전부터 있던 오늘 할 일을, 저녁이 되도록 하나도 완료하지 않았어요
              (저녁에 새로 적은 할 일은 '방치'가 아니라서 세지 않아요)
  - absent: 이번 접속이 '오랜만의 접속'이고 아직 아무것도 완료하지 않았으면 true (TodoApp이 정해요)
*/
export function getTiredReason(todos, { absent = false, now = new Date() } = {}) {
  if (absent) return "absence";

  const today = todayStr();
  if (todos.some((t) => isOverdue(t, today))) return "overdue";

  if (now.getHours() >= EVENING_HOUR) {
    const todayTodos = todos.filter((t) => t.date === today);
    const doneToday = todayTodos.some((t) => t.done);
    // 오늘 저녁 시작 시각 (예: 오늘 20:00)
    const eveningStart = new Date(now);
    eveningStart.setHours(EVENING_HOUR, 0, 0, 0);
    const waitedSinceDay = todayTodos.some((t) => t.createdAt < eveningStart.getTime());
    if (waitedSinceDay && !doneToday) return "evening";
  }

  return null;
}

// 지난 접속일(lastCheckInDate)로 '오랜만의 접속'인지 판단해요.
// (처음 쓰는 사람은 lastCheckInDate가 없어서 오랜만이 아니에요)
export function isLongAbsence(lastCheckInDate, today = todayStr()) {
  return !!lastCheckInDate && daysBetween(lastCheckInDate, today) >= ABSENCE_DAYS;
}

/*
  ▼ 반복 할 일 도우미
  - 요일 번호: 0 일, 1 월, 2 화, 3 수, 4 목, 5 금, 6 토 (자바스크립트 Date와 같아요)
*/

// "YYYY-MM-DD" → 요일 번호
export function weekdayOf(dateStr) {
  return fromDateStr(dateStr).getDay();
}

// 이 반복이 그 날짜에 해당하나요? (요일이 맞고, 시작일이 지났고, 종료일이 안 지났으면)
export function routineMatches(routine, dateStr) {
  return (
    routine.startDate <= dateStr &&
    (!routine.endDate || dateStr <= routine.endDate) &&
    routine.days.includes(weekdayOf(dateStr))
  );
}

// 종료일이 지나서 끝난 반복인가요?
export function isRoutineEnded(routine, today = todayStr()) {
  return !!routine.endDate && routine.endDate < today;
}

// 미래 날짜에 보여 줄 '반복 예정' 미리보기 (저장하지 않은 가짜 할 일)
// - 이미 그날 실제로 만들어진 반복 할 일은 빼요.
export function getRoutinePreviews(routines, todos, dateStr) {
  const made = new Set(todos.filter((t) => t.date === dateStr && t.routineId).map((t) => t.routineId));
  return routines
    .filter((r) => routineMatches(r, dateStr) && !made.has(r.id))
    .map((r) => ({
      id: `preview-${r.id}-${dateStr}`,
      text: r.text,
      date: dateStr,
      originDate: dateStr,
      done: false,
      dueDate: null,
      carryCount: 0,
      bonusXp: 0,
      routineId: r.id,
      isPreview: true,
    }));
}

// 반복 요일을 글로: [1,3,5] → "월·수·금", 7개 모두면 "매일"
const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
export function formatDays(days) {
  if (days.length === 7) return "매일";
  return days.map((d) => WEEKDAY_NAMES[d]).join("·");
}

// 반복 틀을 글로: "월·수·금", 종료일이 있으면 "월·수·금 ~12/31"
export function formatRoutine(routine) {
  return routine.endDate ? `${formatDays(routine.days)} ~${formatShort(routine.endDate)}` : formatDays(routine.days);
}

/*
  ▼ 접속 시 '지난 일 가져오기' 후보
  - 마지막으로 물어본 날(lastCheckInDate)부터 어제까지의 못 한 일만 골라요.
    그 전에 '그냥 두기'한 일은 다시 묻지 않아요.
  - 반복 할 일은 빼요. (넘기기가 없고, 오늘 것이 또 생기니까요)
*/
export function getCheckInCandidates(todos, lastCheckInDate, today = todayStr()) {
  const since = lastCheckInDate || "0000-00-00";
  return todos
    .filter((t) => !t.done && !t.routineId && t.date < today && t.date >= since)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.createdAt - a.createdAt));
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

// 시간 순서 비교: 시간을 정한 일이 먼저, 그 안에서는 이른 시간부터 ("HH:MM"은 글자 비교로 순서가 맞아요)
export function compareTime(a, b) {
  if (!a.time || !b.time) return Number(!a.time) - Number(!b.time);
  return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
}

// 그날 할 일 순서: ⭐ 중요한 일 → 시간을 정한 일(이른 시간부터) → 나머지
// 같은 값끼리는 원래 순서를 지켜요. (sort는 안정 정렬이에요)
export function sortDayTodos(todos) {
  return [...todos].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || compareTime(a, b));
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
