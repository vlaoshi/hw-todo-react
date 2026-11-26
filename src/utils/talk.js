/*
  B 버튼(말 걸기) 대사 고르기
  - 오늘 할 일, 오늘 해낸 일, 다가오는 일정, 경험치 상태 중에서 지금 상황에 맞는 말을 모아
    그중 하나를 무작위로 골라요. (방금 한 말은 연달아 하지 않아요)
  - 피곤한 상태면 절반쯤은 피곤한 이유를 말해요.
*/
import { STAGES, XP_RULES } from "../constants/game.js";
import { MESSAGES } from "../constants/messages.js";
import { todayStr } from "./date.js";
import { getStageIndex, pickRandom } from "./game.js";
import { formatWhen, getUpcoming } from "./reminders.js";

// 경험치 상태 한마디 (예전 B 버튼 대사)
function xpStatusLine(xp) {
  const next = STAGES[getStageIndex(xp) + 1];
  if (!next) return `저는 이미 전설이에요 👑 총 ${xp} XP를 모았어요!`;
  const needXp = next.minXp - xp;
  return `'${next.name}'까지 ${needXp} XP! 할 일 ${Math.ceil(needXp / XP_RULES.COMPLETE)}개만 더 완료해 주세요!`;
}

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

/*
  todos: 전체 할 일, xp: 지금 XP, tiredReason: 피곤한 이유(없으면 null), lastLine: 방금 한 말
  반환: 말할 문장 하나
*/
export function makeTalkLine({ todos, xp, tiredReason, lastLine = null, today = todayStr() }) {
  if (tiredReason && Math.random() < 0.5) return pickRandom(MESSAGES.tired[tiredReason]);

  const todayTodos = todos.filter((t) => t.date === today);
  const undone = todayTodos.filter((t) => !t.done);
  const doneCount = todayTodos.length - undone.length;
  const upcoming = getUpcoming(todos, today).filter((it) => it.kind === "plan");

  // 지금 상황에 맞는 말 후보 (함수로 모아 두고, 뽑힌 것만 문장을 만들어요)
  const pool = [() => xpStatusLine(xp)];

  if (undone.length > 0) {
    // 중요한 일(⭐)이 있으면 그걸 더 자주 언급해요.
    const pick = () => {
      const starred = undone.filter((t) => t.starred);
      return (starred.length && Math.random() < 0.6 ? pickRandom(starred) : pickRandom(undone)).text;
    };
    for (const kind of ["cheer", "curious", "excited", "envy"]) {
      pool.push(() => fill(pickRandom(MESSAGES.talk[kind]), { text: pick() }));
    }
    pool.push(() => fill(pickRandom(MESSAGES.talk.cheer), { text: pick() })); // 응원은 조금 더 자주
  } else if (todayTodos.length > 0) {
    pool.push(() => pickRandom(MESSAGES.talk.allDone), () => pickRandom(MESSAGES.talk.allDone));
  }

  if (doneCount > 0) {
    pool.push(() => fill(pickRandom(MESSAGES.talk.doneToday), { n: String(doneCount) }));
  }

  if (upcoming.length > 0) {
    const near = upcoming.slice(0, 5); // 가까운 일정 위주
    const line = () => {
      const item = pickRandom(near);
      return fill(pickRandom(MESSAGES.talk.upcoming), { when: formatWhen(item.date, today), text: item.todo.text });
    };
    pool.push(line, line);
  }

  // 오늘 할 일도, 다가오는 일정도 없을 때만 '계획 없어요?' (다 끝낸 날과 구분해요)
  if (todayTodos.length === 0 && upcoming.length === 0) pool.push(() => pickRandom(MESSAGES.talk.empty));

  // 방금 한 말과 다른 문장이 나올 때까지 몇 번 다시 뽑아요.
  let text = pickRandom(pool)();
  for (let i = 0; i < 5 && text === lastLine; i++) text = pickRandom(pool)();
  return text;
}
