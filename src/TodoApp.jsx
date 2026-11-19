/*
  다마고치 투두 - 로그인한 뒤의 게임 화면
  ---------------------------------------------------------
  - 로그인한 사용자(user)와 로그아웃 함수(onLogout)는 App이 넘겨줘요.
  - 처음 데이터(initialProfile, initialTodos)는 App이 백엔드에서 불러와서 넘겨줘요.

  핵심 원칙 (기존 app.js와 같아요)
  - 화면은 항상 state(앱 상태)를 보고 그려요.
  - 데이터를 바꾸면: state 변경 → 화면 다시 그리기 → 백엔드에 저장(persist)
    (화면부터 바꾸고 저장은 뒤에서 하므로 앱이 빠르게 느껴져요. 저장에 실패하면 말풍선으로 알려 줘요)
*/
import { useState } from "react";
import { MAX_TEXT_LENGTH, STAGES, XP_RULES } from "./constants/game.js";
import { MESSAGES } from "./constants/messages.js";
import { addDays, formatShort, todayStr } from "./utils/date.js";
import { createId, getCarryTarget, getPendingCount, getStageIndex, isTired, pickRandom } from "./utils/game.js";
import { getErrorMessage } from "./lib/auth.js";
import * as api from "./lib/api.js";
import Device from "./components/Device.jsx";
import TodoPanel from "./components/TodoPanel.jsx";

// 앱을 열었을 때 첫 대사: 다크서클이면 배고프다고, 아니면 단계별 인사
function getGreeting(profile, todos) {
  if (isTired(todos)) return pickRandom(MESSAGES.tired);
  return MESSAGES.greet[STAGES[getStageIndex(profile.xp)].level];
}

export default function TodoApp({ user, initialProfile, initialTodos, onLogout }) {
  const [profile, setProfile] = useState(initialProfile);
  const [todos, setTodos] = useState(initialTodos);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filter, setFilter] = useState("all");
  const [bubbleText, setBubbleText] = useState(() => getGreeting(initialProfile, initialTodos));
  const [soundOn, setSoundOn] = useState(true);

  const pendingCount = getPendingCount(todos);
  const mood = isTired(todos) ? "tired" : "normal"; // 5단계에서 기쁨/충격 같은 잠깐 표정을 더해요

  // 말풍선에 대사 띄우기
  const speak = (text) => setBubbleText(text);

  // 저장을 뒤에서 처리하고, 실패하면 말풍선으로 알려 줘요.
  function persist(...promises) {
    Promise.all(promises).catch((error) => {
      console.error("저장 실패:", error.code || error);
      const isApiError = typeof error?.code === "string" && error.code.startsWith("api/");
      speak(isApiError ? `앗, 저장하지 못했어요 😢 ${getErrorMessage(error)}` : MESSAGES.saveError);
    });
  }

  // XP를 더하거나 빼요. (0 밑으로는 안 내려가요)
  function applyXp(delta) {
    setProfile((p) => {
      const xp = Math.max(0, p.xp + delta);
      return { ...p, xp, stage: getStageIndex(xp) + 1 };
    });
  }

  // 할 일 하나의 일부 내용만 바꿔요.
  function patchTodo(id, patch) {
    setTodos((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  /* ---------- 할 일 기능 ---------- */

  // [추가] 성공하면 true를 돌려줘요. (입력칸을 비울지 정하려고)
  function handleAdd(text, dueDate) {
    const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!trimmed) {
      speak(pickRandom(MESSAGES.emptyInput));
      return false;
    }
    if (dueDate && dueDate < selectedDate) {
      speak(MESSAGES.dueInvalid);
      return false;
    }
    const now = Date.now();
    const todo = {
      id: createId(),
      text: trimmed,
      done: false,
      createdAt: now,
      completedAt: null,
      date: selectedDate, // 지금 보고 있는 날짜에 추가
      dueDate,
      originDate: selectedDate,
      carryCount: 0,
      bonusXp: 0,
    };
    setTodos((list) => [todo, ...list]); // 맨 위에 추가
    speak(pickRandom(MESSAGES.add));
    persist(api.addTodo(todo));
    return true;
  }

  // [완료/해제] 완료 +20 (+ 마감일 당일까지면 보너스 +5) / 해제하면 받은 만큼 모두 회수
  function handleToggle(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const done = !todo.done;
    const gotBonus = done && !!todo.dueDate && todayStr() <= todo.dueDate;
    const bonusXp = gotBonus ? XP_RULES.DUE_BONUS : 0;
    const delta = done ? XP_RULES.COMPLETE + bonusXp : XP_RULES.UNCHECK - (todo.bonusXp || 0);

    patchTodo(id, { done, bonusXp, completedAt: done ? Date.now() : null });
    applyXp(delta);
    if (done) speak(pickRandom(gotBonus ? MESSAGES.bonus : MESSAGES.praise));
    else speak(pickRandom(MESSAGES.uncheck));

    // 완료 시각(completedAt)은 서버가 알아서 정해요.
    persist(api.updateTodo(id, { done, bonusXp }), api.updateProfile({ xpDelta: delta }));
  }

  // [삭제] 완료된 일은 그냥 정리, 미완료 일은 '포기'로 XP -10
  function handleDelete(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    setTodos((list) => list.filter((t) => t.id !== id));
    if (todo.done) {
      // 완료된 일 정리: XP 변화 없음
      speak(pickRandom(MESSAGES.cleanDone));
      persist(api.deleteTodo(id));
    } else {
      // 미완료 할 일 포기: XP -10
      applyXp(XP_RULES.GIVE_UP);
      speak(pickRandom(MESSAGES.giveUp));
      persist(api.deleteTodo(id), api.updateProfile({ xpDelta: XP_RULES.GIVE_UP }));
    }
  }

  // [수정] 글자와 마감일
  function handleEdit(id, { text, dueDate }) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    if (dueDate && dueDate < todo.date) {
      speak(MESSAGES.dueInvalid);
      return;
    }
    patchTodo(id, { text, dueDate });
    speak(pickRandom(MESSAGES.edit));
    persist(api.updateTodo(id, { text, dueDate }));
  }

  // [내일로 / 오늘로] XP -5, 넘긴 횟수 +1
  function handleCarry(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo || todo.done) return;
    const date = getCarryTarget(todo);
    const carryCount = todo.carryCount + 1;
    patchTodo(id, { date, carryCount });
    applyXp(XP_RULES.CARRY);
    speak(pickRandom(MESSAGES.carry));
    persist(api.updateTodo(id, { date, carryCount }), api.updateProfile({ xpDelta: XP_RULES.CARRY }));
  }

  function handleCarryInfo(todo) {
    speak(`${formatShort(todo.originDate)}에 계획했던 할 일이에요. 벌써 ${todo.carryCount}번 넘어왔어요!`);
  }

  /* ---------- 게임기 버튼 ---------- */

  function handlePet() {
    speak(isTired(todos) ? pickRandom(MESSAGES.tired) : pickRandom(MESSAGES.pet));
  }

  // B 버튼: 현재 상태 알려 주기
  function handleTalk() {
    const index = getStageIndex(profile.xp);
    const next = STAGES[index + 1];
    if (isTired(todos)) {
      speak(`미완료 할 일이 ${pendingCount}개예요... 배고파요 😵`);
    } else if (next) {
      const needXp = next.minXp - profile.xp;
      speak(`'${next.name}'까지 ${needXp} XP! 할 일 ${Math.ceil(needXp / XP_RULES.COMPLETE)}개만 더 완료해 주세요!`);
    } else {
      speak(`저는 이미 전설이에요 👑 총 ${profile.xp} XP를 모았어요!`);
    }
  }

  function handleToggleSound() {
    setSoundOn((on) => !on);
    speak(soundOn ? "쉿, 조용히 할게요 🔇" : "소리를 켰어요 🔊");
  }

  return (
    <main className="app">
      <Device
        xp={profile.xp}
        pendingCount={pendingCount}
        mood={mood}
        bubbleText={bubbleText}
        soundOn={soundOn}
        onPet={handlePet}
        onTalk={handleTalk}
        onToggleSound={handleToggleSound}
      />
      <TodoPanel
        todos={todos}
        selectedDate={selectedDate}
        filter={filter}
        user={user}
        onMoveDate={(days) => setSelectedDate((d) => addDays(d, days))}
        onToday={() => setSelectedDate(todayStr())}
        onFilterChange={setFilter}
        onAdd={handleAdd}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onCarry={handleCarry}
        onCarryInfo={handleCarryInfo}
        onLogout={onLogout}
      />
    </main>
  );
}
