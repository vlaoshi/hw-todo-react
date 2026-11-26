/*
  할 일 동작 훅 (useTodoActions) — TodoApp에서 할 일을 바꾸는 동작만 그대로 옮겨 왔어요.
  ---------------------------------------------------------
  - 원칙: state 변경 → 화면 다시 그리기 → 백엔드에 저장(persist)
    (화면부터 바꾸고 저장은 뒤에서 하므로 앱이 빠르게 느껴져요. 저장에 실패하면 사라지지 않는 알림으로 알려 줘요)
  - 모든 동작은 맨 앞에서 오프라인(보기 전용)인지 확인해요.

  받는 값 (ctx)
    todos, selectedDate, absent, tiredReason               지금 상태
    setTodos, setRoutines, setProfile, setSelectedDate,
    setAbsent, setCheckIn, setEngraveMode                  상태 바꾸기
    fx                                                     usePetFx가 돌려준 연출 묶음
    showToast, blockedOffline, soundOnRef, onSuggestSound  알림·오프라인·소리 제안
*/
import { useEffect, useRef } from "react";
import { CARRY_NAG_COUNT, COUNTDOWN_SECONDS, MAX_TEXT_LENGTH, XP_RULES } from "../constants/game.js";
import { MESSAGES } from "../constants/messages.js";
import { formatShort, todayStr } from "../utils/date.js";
import { createId, formatRoutine, getCarryTarget, getStageIndex, getTiredReason, pickRandom, routineMatches } from "../utils/game.js";
import { getErrorMessage } from "../lib/auth.js";
import { markSoundSuggested, shouldSuggestSound } from "../lib/sound.js";
import { TOAST_MS } from "../components/Toast.jsx";
import * as api from "../lib/api.js";

// 새 보통 할 일 객체 만들기 (화면에 바로 보여 주고, 서버 저장은 뒤에서 해요)
function createTodo(text, date, dueDate) {
  const now = Date.now();
  return {
    id: createId(), // 임시 아이디 (서버가 정한 아이디는 api.js가 따로 기억해요)
    text,
    done: false,
    createdAt: now,
    completedAt: null,
    date,
    dueDate,
    originDate: date,
    carryCount: 0,
    bonusXp: 0,
    routineId: null,
    starred: false,
  };
}

// 넘기기 대사: 같은 할 일을 여러 번 넘기면 잔소리
function getCarryMessage(count) {
  if (count >= CARRY_NAG_COUNT) return pickRandom(MESSAGES.carryNag).replace("{n}", String(count));
  return pickRandom(MESSAGES.carry);
}

export default function useTodoActions(ctx) {
  const {
    todos,
    selectedDate,
    absent,
    tiredReason,
    setTodos,
    setRoutines,
    setProfile,
    setSelectedDate,
    setAbsent,
    setCheckIn,
    setEngraveMode,
    fx,
    showToast,
    blockedOffline,
    soundOnRef,
    onSuggestSound,
  } = ctx;
  const { speak, flashMood, sound, showXpChange, feedPet, shockPet, handleStageChange, xpRef, deviceVisibleRef, batchRef } = fx;

  // 되돌리기를 기다리는 지우기: 할 일 id → { timer, commit } (5초 뒤 서버에서 지워요)
  const pendingDeletesRef = useRef(new Map());

  // 화면이 사라질 때(로그아웃 등): 되돌리기를 기다리던 지우기는 바로 서버로 보내요.
  useEffect(() => {
    const pendingDeletes = pendingDeletesRef.current;
    return () => {
      for (const { timer, commit } of pendingDeletes.values()) {
        clearTimeout(timer);
        commit();
      }
    };
  }, []);

  /* ---------- 저장 도우미 ---------- */

  // 저장을 뒤에서 처리하고, 실패하면 사라지지 않는 알림으로 알려 줘요.
  function persist(...promises) {
    Promise.all(promises).catch((error) => {
      console.error("저장 실패:", error.code || error);
      showSaveError(error);
    });
  }

  // 저장 실패 알림: 닫을 때까지 남아 있고, '새로고침'으로 서버에 저장된 상태로 화면을 다시 맞춰요.
  // (말풍선에만 띄우면 혼잣말에 금방 덮여서 놓치기 쉬워요)
  function showSaveError(error) {
    showToast({
      text: getSaveErrorText(error),
      actionLabel: "새로고침",
      onAction: () => window.location.reload(),
      sticky: true,
    });
  }

  function getSaveErrorText(error) {
    const isApiError = typeof error?.code === "string" && error.code.startsWith("api/");
    return isApiError ? `저장하지 못했어요. ${getErrorMessage(error)}` : MESSAGES.saveError;
  }

  // XP를 더하거나 빼고(0 밑으로는 안 내려가요), 이전/이후 단계를 알려 줘요.
  function applyXp(delta) {
    const oldXp = xpRef.current;
    const xp = Math.max(0, oldXp + delta);
    xpRef.current = xp;
    setProfile((p) => ({ ...p, xp, stage: getStageIndex(xp) + 1 }));
    showXpChange(delta);
    return { oldStage: getStageIndex(oldXp), newStage: getStageIndex(xp) };
  }

  // 할 일 하나의 일부 내용만 바꿔요.
  function patchTodo(id, patch) {
    setTodos((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  // 서버에서 받은 할 일을 목록 맨 위에 합쳐요. (이미 있는 할 일은 건너뛰어요)
  function mergeTodos(newTodos) {
    setTodos((list) => {
      const ids = new Set(list.map((t) => t.id));
      return [...newTodos.filter((t) => !ids.has(t.id)), ...list];
    });
  }

  /* ---------- 할 일 기능 ---------- */

  // [추가] 성공하면 true를 돌려줘요. (입력칸을 비울지 정하려고)
  // repeat: 반복이면 { days, endDate }, 보통 할 일이면 null
  async function handleAdd(text, dueDate, repeat) {
    if (blockedOffline()) return false;
    const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!trimmed) {
      speak(pickRandom(MESSAGES.emptyInput));
      return false;
    }
    if (repeat) return addRoutine(trimmed, repeat);

    if (dueDate && dueDate < selectedDate) {
      speak(MESSAGES.dueInvalid);
      return false;
    }
    const todo = createTodo(trimmed, selectedDate, dueDate); // 지금 보고 있는 날짜에 추가
    setTodos((list) => [todo, ...list]); // 맨 위에 추가
    flashMood("happy");
    speak(pickRandom(MESSAGES.add));
    sound("add");
    persist(api.addTodo(todo));
    return true;
  }

  // [반복 추가] 반복 틀은 서버 id가 필요해서 저장이 끝날 때까지 기다려요.
  // 오늘이 반복 요일이면 오늘 할 일도 바로 만들어요.
  async function addRoutine(text, { days, endDate }) {
    if (days.length === 0) {
      speak(MESSAGES.routineNoDays);
      return false;
    }
    if (endDate && endDate < selectedDate) {
      speak(MESSAGES.routineEndInvalid);
      return false;
    }
    try {
      const routine = await api.createRoutine({ text, days, startDate: selectedDate, endDate });
      setRoutines((list) => [...list, routine]);

      const today = todayStr();
      if (routineMatches(routine, today)) mergeTodos(await api.materializeRoutines(today));

      flashMood("happy");
      speak(pickRandom(MESSAGES.addRoutine).replace("{days}", formatRoutine(routine)));
      sound("add");
      return true;
    } catch (error) {
      console.error("반복 추가 실패:", error.code || error);
      showSaveError(error);
      return false;
    }
  }

  // [반복 그만하기] 앞으로 안 생기게만 하고, 이미 만든 할 일은 남겨요.
  function handleStopRoutine(routineId) {
    if (blockedOffline()) return;
    setRoutines((list) => list.filter((r) => r.id !== routineId));
    speak(MESSAGES.routineStopped);
    sound("click");
    persist(api.stopRoutine(routineId));
  }

  // [완료/해제] 완료 +20 (+ 마감일 당일까지면 보너스 +5) / 해제하면 받은 만큼 모두 회수
  function handleToggle(id) {
    if (blockedOffline()) return;
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const done = !todo.done;
    const gotBonus = done && !!todo.dueDate && todayStr() <= todo.dueDate;
    const bonusXp = gotBonus ? XP_RULES.DUE_BONUS : 0;
    const delta = done ? XP_RULES.COMPLETE + bonusXp : XP_RULES.UNCHECK - (todo.bonusXp || 0);
    const patch = { done, bonusXp, completedAt: done ? Date.now() : null };

    // 완료 후에도 피곤한지 미리 계산해서, 피곤함이 풀렸으면 '회복' 대사를 해요.
    const nextTodos = todos.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const nextAbsent = done ? false : absent; // 오랜만의 피곤함은 첫 완료로 풀려요
    const recovered = !!tiredReason && !getTiredReason(nextTodos, { absent: nextAbsent });

    // 게임기가 안 보이는데 완료했다면 → 카운트다운 묶음 시작 (XP를 바꾸기 전에 화면 XP 고정)
    if (done && !deviceVisibleRef.current && !batchRef.current) fx.startBatch();

    patchTodo(id, patch);
    setAbsent(nextAbsent);
    const { oldStage, newStage } = applyXp(delta);
    const batch = batchRef.current;

    if (batch) {
      // ----- 카운트다운으로 모으는 중 -----
      batch.count += done ? 1 : -1;
      if (done) {
        // 미니 다마고치가 살짝 기뻐하고, 3초부터 다시 세요.
        flashMood("happy", 900);
        fx.playMiniHappy();
        sound("eat");
        // 이미 게임기로 올라가는 중이면 카운트다운은 다시 시작하지 않아요. (도착하면 함께 보여 줌)
        if (!batch.revealing) {
          fx.restartCountdown();
          const bonusText = gotBonus ? " 마감 보너스 +5 🎁" : "";
          speak(`냠! ${batch.count}개째 완료!${bonusText} ${COUNTDOWN_SECONDS}초 뒤에 보러 가요 👀`);
        }
      } else {
        // 해제: 모은 걸 다 해제했으면 카운트다운 취소, 남은 게 있으면 그대로 계속
        if (batch.count <= 0 && !batch.revealing) fx.cancelBatch();
        flashMood("shocked", 1200);
        sound("down");
        speak(pickRandom(MESSAGES.uncheck));
      }
    } else if (done) {
      // 처음 완료할 때 한 번: 효과음을 켤지 제안해요 (처음에는 꺼져 있어서)
      if (!soundOnRef.current && shouldSuggestSound()) {
        markSoundSuggested();
        showToast({ text: "냠냠 소리도 들어 볼래요? 🔊", actionLabel: "효과음 켜기", onAction: onSuggestSound });
      }
      // 완료: 밥 먹기 + 칭찬, 밥을 다 먹은 뒤에 진화하도록 조금 늦게 연출
      const duration = feedPet();
      sound("eat");
      speak(pickRandom(recovered ? MESSAGES.recovered : gotBonus ? MESSAGES.bonus : MESSAGES.praise));
      handleStageChange(oldStage, newStage, duration);
    } else {
      // 해제: XP 회수 + 시무룩
      flashMood("shocked", 1200);
      sound("down");
      speak(pickRandom(MESSAGES.uncheck));
      handleStageChange(oldStage, newStage, 900);
    }

    // 완료 시각(completedAt)은 서버가 알아서 정해요.
    persist(api.updateTodo(id, { done, bonusXp }), api.updateProfile({ xpDelta: delta }));
  }

  /*
    [지우기] reason: "done"(완료한 일 정리) | "unneeded"(필요 없어졌어요) → XP 그대로
                     "giveUp"(포기할래요) → XP -10 (반복 할 일도 같아요)
    - 5초 동안 '되돌리기'를 누를 수 있게, 서버에서 지우는 건 알림이 사라진 뒤에 해요.
      (그 전에 화면을 닫거나 로그아웃하면 그때 바로 지워요)
  */
  function handleDelete(id, reason = "giveUp") {
    if (blockedOffline()) return;
    const index = todos.findIndex((t) => t.id === id);
    const todo = todos[index];
    if (!todo) return;
    const giveUp = reason === "giveUp" && !todo.done;
    const delta = giveUp ? XP_RULES.GIVE_UP : 0;

    setTodos((list) => list.filter((t) => t.id !== id));
    if (giveUp) {
      // 포기: 충격 + 잔소리 + XP -10
      const { oldStage, newStage } = applyXp(delta);
      shockPet();
      sound("shock");
      speak(pickRandom(MESSAGES.giveUp));
      // 카운트다운 중이면 단계 변화는 나중에 한꺼번에 보여 줘요.
      if (!batchRef.current) handleStageChange(oldStage, newStage, 1500);
    } else {
      speak(pickRandom(todo.done ? MESSAGES.cleanDone : MESSAGES.unneeded));
      sound("click");
    }

    // 서버에서 지우기는 잠시 미뤄요 (되돌리기를 누르면 취소)
    const commit = () => {
      pendingDeletesRef.current.delete(id);
      persist(api.deleteTodo(id), delta ? api.updateProfile({ xpDelta: delta }) : null);
    };
    const timer = setTimeout(commit, TOAST_MS + 300);
    pendingDeletesRef.current.set(id, { timer, commit });

    showToast({
      text: giveUp ? `포기했어요 (XP ${delta})` : "지웠어요",
      actionLabel: "되돌리기",
      onAction: () => undoDelete(id, todo, index, delta),
    });
  }

  // 지우기 되돌리기: 아직 서버에 보내지 않았으니 화면만 원래대로 돌려요.
  function undoDelete(id, todo, index, delta) {
    const pending = pendingDeletesRef.current.get(id);
    if (!pending) return; // 이미 서버에서 지워졌다면 되돌릴 수 없어요
    clearTimeout(pending.timer);
    pendingDeletesRef.current.delete(id);
    setTodos((list) => {
      const next = [...list];
      next.splice(Math.min(index, next.length), 0, todo); // 원래 자리로
      return next;
    });
    if (delta) applyXp(-delta);
    flashMood("happy");
    speak("휴~ 되돌렸어요! 다시 같이 해 봐요 💪");
    sound("add");
  }

  // [⭐ 중요 표시] 그날 목록 맨 위에 고정 / 해제 (XP 변화 없음)
  function handleStar(id) {
    if (blockedOffline()) return;
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const starred = !todo.starred;
    patchTodo(id, { starred });
    if (starred) {
      flashMood("happy", 900);
      speak(pickRandom(MESSAGES.starOn));
    } else {
      speak(MESSAGES.starOff);
    }
    sound("click");
    persist(api.updateTodo(id, { starred }));
  }

  // [수정] 글자와 마감일 (+ 보통 할 일을 반복 할 일로 바꾸기)
  // repeat: { days, endDate } 이면 이 할 일 날짜부터 반복을 만들고, 이 할 일을 그날의 반복 할 일로 연결해요.
  async function handleEdit(id, { text, dueDate, repeat }) {
    if (blockedOffline()) return;
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    if (dueDate && dueDate < todo.date) {
      speak(MESSAGES.dueInvalid);
      return;
    }
    const textChanged = text !== todo.text || dueDate !== (todo.dueDate || null);
    if (textChanged) {
      patchTodo(id, { text, dueDate });
      persist(api.updateTodo(id, { text, dueDate }));
    }
    if (!repeat) {
      speak(pickRandom(MESSAGES.edit));
      sound("click");
      return;
    }

    // ----- 반복 할 일로 바꾸기 -----
    if (repeat.days.length === 0) {
      speak(MESSAGES.routineNoDays);
      return;
    }
    if (repeat.endDate && repeat.endDate < todo.date) {
      speak(MESSAGES.routineEndInvalid);
      return;
    }
    try {
      const routine = await api.createRoutine({
        text,
        days: repeat.days,
        startDate: todo.date,
        endDate: repeat.endDate,
        fromTodoId: id,
      });
      setRoutines((list) => [...list, routine]);
      patchTodo(id, { routineId: routine.id }); // 이 할 일이 그날의 반복 할 일이 돼요 ('내일로' 버튼이 사라져요)

      // 이 할 일이 오늘 것이 아니고 오늘이 반복 요일이면, 오늘 할 일도 바로 만들어요.
      const today = todayStr();
      if (todo.date !== today && routineMatches(routine, today)) {
        mergeTodos(await api.materializeRoutines(today));
      }
      flashMood("happy");
      speak(pickRandom(MESSAGES.addRoutine).replace("{days}", formatRoutine(routine)));
      sound("add");
    } catch (error) {
      console.error("반복으로 바꾸기 실패:", error.code || error);
      showSaveError(error);
    }
  }

  // [내일로 / 오늘로] XP -5, 넘긴 횟수 +1 (반복 할 일은 넘기기 없음)
  function handleCarry(id) {
    if (blockedOffline()) return;
    const todo = todos.find((t) => t.id === id);
    if (!todo || todo.done) return;
    if (todo.routineId) {
      speak(MESSAGES.routineNoCarry);
      return;
    }
    const date = getCarryTarget(todo);
    const carryCount = todo.carryCount + 1;
    patchTodo(id, { date, carryCount });
    const { oldStage, newStage } = applyXp(XP_RULES.CARRY);

    // 3번째부터는 충격 + 잔소리
    if (carryCount >= CARRY_NAG_COUNT) {
      shockPet();
      sound("shock");
    } else {
      flashMood("shocked", 900);
      sound("down");
    }
    speak(getCarryMessage(carryCount));
    if (!batchRef.current) handleStageChange(oldStage, newStage, 1200);
    persist(api.updateTodo(id, { date, carryCount }), api.updateProfile({ xpDelta: XP_RULES.CARRY }));

    // 5초 동안 되돌리기: 날짜와 넘긴 횟수, XP를 원래대로
    const prev = { date: todo.date, carryCount: todo.carryCount };
    showToast({
      text: `${date === todayStr() ? "오늘로" : "다음 날로"} 넘겼어요 (XP ${XP_RULES.CARRY})`,
      actionLabel: "되돌리기",
      onAction: () => {
        patchTodo(id, prev);
        applyXp(-XP_RULES.CARRY);
        speak("넘기기를 취소했어요. 오늘 해치워 봐요! 🔥");
        sound("add");
        persist(api.updateTodo(id, prev), api.updateProfile({ xpDelta: -XP_RULES.CARRY }));
      },
    });
  }

  function handleCarryInfo(todo) {
    speak(`${formatShort(todo.originDate)}에 계획했던 할 일이에요. 벌써 ${todo.carryCount}번 넘어왔어요!`);
  }

  /* ---------- 접속 시 '지난 일 가져오기' ---------- */

  // ids: 가져올 할 일 id 목록 (빈 배열이면 '그냥 두기')
  function handleCheckIn(ids) {
    if (blockedOffline()) return;
    const today = todayStr();
    const picked = new Set(ids);
    const moved = todos.filter((t) => picked.has(t.id) && !t.done);

    setCheckIn(null);
    setSelectedDate(today);
    setProfile((p) => ({ ...p, lastCheckInDate: today })); // 오늘은 다시 묻지 않아요 (다른 기기에서도)

    if (moved.length === 0) {
      speak(MESSAGES.checkinSkip);
      persist(api.updateProfile({ lastCheckInDate: today }));
      return;
    }

    // 넘기기와 같은 규칙: 오늘로 옮기고, 넘긴 횟수 +1, 1개당 XP -5
    const delta = XP_RULES.CARRY * moved.length;
    setTodos((list) =>
      list.map((t) => (picked.has(t.id) && !t.done ? { ...t, date: today, carryCount: t.carryCount + 1 } : t))
    );
    const { oldStage, newStage } = applyXp(delta);
    const maxCount = Math.max(...moved.map((t) => t.carryCount + 1));
    if (maxCount >= CARRY_NAG_COUNT) {
      shockPet();
      speak(getCarryMessage(maxCount));
    } else {
      flashMood("shocked", 900);
      speak(MESSAGES.checkinBring.replace("{n}", String(moved.length)));
    }
    sound("down");
    handleStageChange(oldStage, newStage, 1200);
    persist(
      ...moved.map((t) => api.updateTodo(t.id, { date: today, carryCount: t.carryCount + 1 })),
      api.updateProfile({ xpDelta: delta, lastCheckInDate: today })
    );
  }

  /* ---------- 게임기 각인 ---------- */

  // text: 새길 문구 ("": 안 새기기, 기본 로고)
  function handleEngrave(text) {
    if (blockedOffline()) return;
    setEngraveMode(null);
    setProfile((p) => ({ ...p, engraving: text }));
    if (text) {
      flashMood("happy");
      speak(`게임기에 '${text}' 새겼어요! 마음에 쏙 들어요 ✨`);
      sound("evolve");
    } else {
      speak("알겠어요! 새기고 싶을 때 프로필 메뉴에서 불러 주세요 😊");
      sound("click");
    }
    persist(api.updateProfile({ engraving: text }));
  }

  return {
    handleAdd,
    handleStopRoutine,
    handleToggle,
    handleDelete,
    handleStar,
    handleEdit,
    handleCarry,
    handleCarryInfo,
    handleCheckIn,
    handleEngrave,
  };
}
