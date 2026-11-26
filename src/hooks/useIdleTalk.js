/*
  혼잣말 훅: 한동안 조용하면 다가오는 일정(리마인드)이나 평소 혼잣말을 해요.
  - 5초마다 확인해서, 설정한 시간(자주 30초 · 가끔 1분) 넘게 아무 말이 없었으면 말해요.
  - 혼잣말 끄기면 아무것도 안 하고, 다른 탭을 보고 있으면 쉬어요.
  - 혼잣말은 { idle: true }로 말해서, 화면낭독기 읽기 설정이 켜졌을 때만 소리 내어 읽혀요.

  받는 값: { idleMode, todos, tiredReason, xpRef, lastSpeakRef, speakRef }
*/
import { useEffect, useRef } from "react";
import { STAGES } from "../constants/game.js";
import { MESSAGES } from "../constants/messages.js";
import { getStageIndex, pickRandom } from "../utils/game.js";
import { makeReminder } from "../utils/reminders.js";

// 설정의 '혼잣말 빈도'에 따라 기다리는 시간 (끄기면 없음)
const IDLE_TALK_MS = { often: 30000, sometimes: 60000 };
// 혼잣말할 때 다가오는 일정을 말할 확률 (나머지는 평소 혼잣말)
const IDLE_REMIND_CHANCE = 0.7;

// 평소 혼잣말: 피곤하면 그 이유, 전설 단계면 전설 대사, 아니면 일반 혼잣말
function getIdleLine(tiredReason, xp) {
  if (tiredReason) return pickRandom(MESSAGES.tired[tiredReason]);
  if (getStageIndex(xp) === STAGES.length - 1) return pickRandom(MESSAGES.idleLegend);
  return pickRandom(MESSAGES.idle);
}

export default function useIdleTalk({ idleMode, todos, tiredReason, xpRef, lastSpeakRef, speakRef }) {
  const lastReminderRef = useRef(null); // 마지막으로 리마인드한 일정 (같은 일정을 연달아 말하지 않게)

  useEffect(() => {
    const waitMs = IDLE_TALK_MS[idleMode];
    if (!waitMs) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastSpeakRef.current < waitMs) return;

      const reminder =
        Math.random() < IDLE_REMIND_CHANCE ? makeReminder(todos, lastReminderRef.current) : null;
      if (reminder) lastReminderRef.current = reminder.key;
      speakRef.current?.(reminder ? reminder.text : getIdleLine(tiredReason, xpRef.current), { idle: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [todos, tiredReason, idleMode, xpRef, lastSpeakRef, speakRef]);
}
