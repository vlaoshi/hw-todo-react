/*
  스케줄 페이지용 계산 (한 달씩 보기)
  - 고른 달("YYYY-MM")의 할 일을 날짜별로 묶어요. 지난 날짜도 포함해요. (이전 달 기록 보기)
  - 하는 날(date)에 한 번, 마감일(dueDate)이 다른 날이면 그날에도 '마감'으로 한 번 더 넣어요.
  - 반복 할 일은 '반복 할 일 포함'을 켰을 때만 넣어요. (기본은 일회성 일정만)
    켜면 실제로 만들어진 반복 할 일 + 오늘 이후 날짜의 '반복 예정' 미리보기를 넣어요.
*/
import { addDays, daysBetween, todayStr } from "./date.js";
import { compareTime, getRoutinePreviews } from "./game.js";

// "2026-11" → "2026년 11월"
export function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

// "2026-11"에 n달 더하기 (빼려면 음수) → "2026-12"
export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// 오늘이 속한 달 "YYYY-MM"
export function currentMonth(today = todayStr()) {
  return today.slice(0, 7);
}

/*
  반환 모양: [{ date: "2026-11-27", items: [{ kind: "plan" | "due", todo }] }, ...] (날짜순, 일정 있는 날만)
  options.routines        : 반복 중인 틀 목록 (미리보기를 만들 때 써요)
  options.includeRoutines : true면 반복 할 일도 넣어요
*/
export function getScheduleDays(todos, month, today = todayStr(), { routines = [], includeRoutines = false } = {}) {
  const inMonth = (date) => !!date && date.startsWith(month);
  const byDate = new Map(); // 날짜 → 항목 목록

  const add = (date, item) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };

  for (const todo of todos) {
    if (todo.routineId && !includeRoutines) continue; // 일회성 일정만 볼 때는 반복 할 일을 빼요
    if (inMonth(todo.date)) add(todo.date, { kind: "plan", todo });
    // 마감일이 하는 날과 다르면, 마감일에도 표시 (완료한 일은 마감 걱정이 없으니 빼요)
    if (!todo.done && inMonth(todo.dueDate) && todo.dueDate !== todo.date) {
      add(todo.dueDate, { kind: "due", todo });
    }
  }

  // 반복 예정 미리보기: 이 달 안에서 오늘 이후 날짜만 (지난 날은 실제로 생긴 할 일만 보여 줘요)
  if (includeRoutines && routines.length) {
    for (let date = `${month}-01`; inMonth(date); date = addDays(date, 1)) {
      if (date < today) continue;
      for (const preview of getRoutinePreviews(routines, todos, date)) add(date, { kind: "plan", todo: preview });
    }
  }

  // 날짜 안에서는: ⭐ 중요한 일 → 못 한 일 → 반복 예정 → 마감 → 완료한 일
// 같은 종류끼리는 시간을 정한 일(이른 시간부터) → 먼저 만든 순서
  const order = (item) =>
    item.todo.done ? 4 : item.kind === "due" ? 3 : item.todo.isPreview ? 2 : item.todo.starred ? 0 : 1;

  return [...byDate.keys()].sort().map((date) => ({
    date,
    items: byDate
      .get(date)
      .sort(
        (a, b) =>
          order(a) - order(b) ||
          compareTime(a.todo, b.todo) ||
          (a.todo.createdAt ?? 0) - (b.todo.createdAt ?? 0)
      ),
  }));
}

// 날짜 제목 옆에 붙일 상대 날짜: 오늘 / 내일 / 모레 / 5일 뒤 / 어제 / 3일 전
export function relativeDayLabel(date, today = todayStr()) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  if (diff === -1) return "어제";
  return diff > 0 ? `${diff}일 뒤` : `${-diff}일 전`;
}
