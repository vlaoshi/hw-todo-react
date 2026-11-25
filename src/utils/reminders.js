/*
  다가오는 일정 리마인드
  - 미래 날짜에 적어 둔 할 일과 마감이 다가오는 할 일을 골라, 다마고치가 말할 문장을 만들어요.
  - 지금은 MVP라 정해진 문장 틀(MESSAGES.remindPlan / remindDue)에 날짜와 내용만 넣어요.
*/
import { MESSAGES } from "../constants/messages.js";
import { addDays, daysBetween, formatLong, fromDateStr, todayStr } from "./date.js";
import { pickRandom } from "./game.js";

// 얼마나 앞까지 알려 줄지
const PLAN_DAYS = 14; // 미래 할 일: 2주 안
const DUE_DAYS = 7; // 마감: 일주일 안

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 오늘부터 며칠 뒤인지에 따라 자연스러운 말로: 오늘 / 내일 / 모레 / 5일 뒤 (월) / 12월 3일 (수)
export function formatWhen(dateStr, today = todayStr()) {
  const diff = daysBetween(today, dateStr);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  if (diff <= 6) return `${diff}일 뒤 (${WEEKDAY_NAMES[fromDateStr(dateStr).getDay()]})`;
  return formatLong(dateStr);
}

/*
  알려 줄 만한 일정 목록 (가까운 순)
  - plan: 내일부터 2주 안에 하기로 한 할 일
  - due : 오늘부터 일주일 안에 마감인 할 일 (하는 날이 오늘이 아닌 것만, 오늘 할 일은 목록에 이미 보이니까요)
  - 완료한 일은 빼요.
*/
export function getUpcoming(todos, today = todayStr()) {
  const planEnd = addDays(today, PLAN_DAYS);
  const dueEnd = addDays(today, DUE_DAYS);
  const list = [];
  for (const t of todos) {
    if (t.done) continue;
    if (t.date > today && t.date <= planEnd) list.push({ kind: "plan", todo: t, date: t.date });
    if (t.dueDate && t.date !== today && t.dueDate >= today && t.dueDate <= dueEnd) {
      list.push({ kind: "due", todo: t, date: t.dueDate });
    }
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/*
  리마인드 문장 하나 만들기 (알려 줄 게 없으면 null)
  - 가까운 일정일수록 더 자주 뽑혀요. (앞쪽 절반에서 고를 확률을 높여요)
  - lastKey: 바로 전에 말한 일정 (같은 말을 연달아 하지 않으려고). 고른 일정의 key도 같이 돌려줘요.
*/
export function makeReminder(todos, lastKey = null, today = todayStr()) {
  let items = getUpcoming(todos, today);
  if (items.length > 1) items = items.filter((it) => keyOf(it) !== lastKey);
  if (items.length === 0) return null;

  const near = items.slice(0, Math.ceil(items.length / 2));
  const item = Math.random() < 0.7 ? pickRandom(near) : pickRandom(items);
  const template = pickRandom(item.kind === "due" ? MESSAGES.remindDue : MESSAGES.remindPlan);
  const text = template.replace("{when}", formatWhen(item.date, today)).replace("{text}", item.todo.text);
  return { text, key: keyOf(item) };
}

function keyOf(item) {
  return `${item.kind}:${item.todo.id}`;
}
