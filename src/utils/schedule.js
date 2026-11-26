/*
  스케줄 페이지용 계산
  - 오늘부터 앞으로의 할 일을 '월 → 날짜' 순서로 묶어요.
  - 하는 날(date)에 한 번, 마감일(dueDate)이 다른 날이면 그날에도 '마감'으로 한 번 더 넣어요.
  - 반복 할 일은 '반복 할 일도 보기'를 켰을 때만 넣어요. (기본은 일회성 일정만)
    켜면 이미 만들어진 반복 할 일 + 앞으로 4주 동안의 '반복 예정' 미리보기를 넣어요.
    (매일 반복하는 일이 끝없이 이어지지 않게 4주로 제한해요)
*/
import { addDays, daysBetween, todayStr } from "./date.js";
import { getRoutinePreviews } from "./game.js";

// 반복 예정 미리보기를 보여 줄 기간 (오늘 포함 4주)
export const ROUTINE_PREVIEW_DAYS = 28;

/*
  반환 모양: [
    { month: "2026-11", label: "2026년 11월", days: [
      { date: "2026-11-27", items: [{ kind: "plan" | "due", todo }] }, ...
    ] }, ...
  ]
  options.routines        : 반복 중인 틀 목록 (미리보기를 만들 때 써요)
  options.includeRoutines : true면 반복 할 일도 넣어요
*/
export function getScheduleMonths(todos, today = todayStr(), { routines = [], includeRoutines = false } = {}) {
  const byDate = new Map(); // 날짜 → 항목 목록

  const add = (date, item) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };

  for (const todo of todos) {
    if (todo.routineId && !includeRoutines) continue; // 일회성 일정만 볼 때는 반복 할 일을 빼요
    if (todo.date >= today) add(todo.date, { kind: "plan", todo });
    // 마감일이 하는 날과 다르면, 마감일에도 표시 (완료한 일은 마감 걱정이 없으니 빼요)
    if (!todo.done && todo.dueDate && todo.dueDate >= today && todo.dueDate !== todo.date) {
      add(todo.dueDate, { kind: "due", todo });
    }
  }

  // 반복 예정 미리보기 (오늘부터 4주, 이미 만들어진 날은 getRoutinePreviews가 빼 줘요)
  if (includeRoutines && routines.length) {
    for (let i = 0; i < ROUTINE_PREVIEW_DAYS; i++) {
      const date = addDays(today, i);
      for (const preview of getRoutinePreviews(routines, todos, date)) add(date, { kind: "plan", todo: preview });
    }
  }

  // 날짜 안에서는: ⭐ 중요한 일 → 못 한 일 → 반복 예정 → 마감 → 완료한 일, 같은 종류끼리는 먼저 만든 순서
  // (못 한 일 중에서도 중요한 일 ⭐이 맨 위)
  const order = (item) =>
    item.todo.done ? 4 : item.kind === "due" ? 3 : item.todo.isPreview ? 2 : item.todo.starred ? 0 : 1;
  const months = new Map();
  for (const date of [...byDate.keys()].sort()) {
    const items = byDate
      .get(date)
      .sort((a, b) => order(a) - order(b) || (a.todo.createdAt ?? 0) - (b.todo.createdAt ?? 0));
    const month = date.slice(0, 7);
    if (!months.has(month)) {
      const [y, m] = month.split("-").map(Number);
      months.set(month, { month, label: `${y}년 ${m}월`, days: [] });
    }
    months.get(month).days.push({ date, items });
  }
  return [...months.values()];
}

// 날짜 제목 옆에 붙일 상대 날짜: 오늘 / 내일 / 모레 / 5일 뒤
export function relativeDayLabel(date, today = todayStr()) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  return `${diff}일 뒤`;
}
