/*
  다마고치 투두 - 로그인한 뒤의 게임 화면
  ---------------------------------------------------------
  - 로그인한 사용자(user)와 로그아웃 함수(onLogout)는 App이 넘겨줘요.
  - 처음 데이터(initialProfile, initialTodos, initialRoutines)는 App이 백엔드에서 불러와서 넘겨줘요.
    (오늘의 반복 할 일은 App이 불러오기 전에 미리 만들어 둬요)

  핵심 원칙 (기존 app.js와 같아요)
  - 화면은 항상 state(앱 상태)를 보고 그려요.
  - 데이터를 바꾸면: state 변경 → 화면 다시 그리기 → 백엔드에 저장(persist)
    (화면부터 바꾸고 저장은 뒤에서 하므로 앱이 빠르게 느껴져요. 저장에 실패하면 말풍선으로 알려 줘요)

  다마고치 기분
  - 할 일을 추가하면 기뻐해요. (할 일 = 먹을 밥!)
  - 피곤함은 '방치'됐을 때만: 오랜만의 접속 / 마감 지난 일 / 저녁까지 완료 0개 (utils/game.js의 getTiredReason)

  연출 (기존 HTML 버전에서 옮겨 왔어요)
  - 효과음(lib/sound.js), 음식·XP 글자·진화 배너·폭죽(lib/fx.js)
  - 미니 다마고치: 목록을 보느라 게임기가 화면 밖에 있으면 오른쪽 아래에 따라다니며 말해요.
  - 완료 카운트다운: 게임기가 안 보일 때 완료하면 3초 카운트다운 → 0이 되면 게임기로 올라가서
    모아 둔 반응(밥 먹기, XP, 진화)을 한 번에 보여 줘요.
    ※ XP는 체크하는 순간 바로 저장해요. 미뤄지는 건 '보여 주는 연출'뿐이에요.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { CARRY_NAG_COUNT, COUNTDOWN_SECONDS, FOODS, MAX_TEXT_LENGTH, STAGES, XP_RULES } from "./constants/game.js";
import { MESSAGES } from "./constants/messages.js";
import { addDays, formatShort, todayStr } from "./utils/date.js";
import {
  createId,
  formatRoutine,
  getCarryTarget,
  getCheckInCandidates,
  getPendingCount,
  getStageIndex,
  getTiredReason,
  getXpProgress,
  isLongAbsence,
  pickRandom,
  routineMatches,
} from "./utils/game.js";
import { makeReminder } from "./utils/reminders.js";
import { makeTalkLine } from "./utils/talk.js";
import { launchConfetti, playAnimation, spawnEffect } from "./lib/fx.js";
import { loadSoundPref, markSoundSuggested, playSound, saveSoundPref, shouldSuggestSound } from "./lib/sound.js";
import { getErrorMessage } from "./lib/auth.js";
import { saveSnapshot } from "./lib/offline.js";
import * as api from "./lib/api.js";
import AppHeader from "./components/AppHeader.jsx";
import CheckInCard from "./components/CheckInCard.jsx";
import EngraveModal from "./components/EngraveModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import Device from "./components/Device.jsx";
import MiniPet from "./components/MiniPet.jsx";
import PetCard from "./components/PetCard.jsx";
import SchedulePanel from "./components/SchedulePanel.jsx";
import TodoPanel from "./components/TodoPanel.jsx";
import Toast, { TOAST_MS } from "./components/Toast.jsx";
import ViewTabs from "./components/ViewTabs.jsx";

// 한동안 아무 말이 없으면 혼잣말을 해요. 설정의 '혼잣말 빈도'에 따라 기다리는 시간이 달라요. (끄기면 안 해요)
const IDLE_TALK_MS = { often: 30000, sometimes: 60000 };
// 혼잣말할 때 다가오는 일정을 말할 확률 (나머지는 평소 혼잣말)
const IDLE_REMIND_CHANCE = 0.7;
// 미니 말풍선을 보여 주는 시간
const MINI_BUBBLE_MS = 4000;

/*
  접속했을 때 한 번만 정하는 값
  - absent      : 오랜만의 접속인가요? (지난 접속일이 2일 이상 전)
  - candidates  : '지난 일 가져오기' 창에 보여 줄 할 일 (없으면 빈 배열)
  - checkedToday: 오늘 이미 물어봤으면 true (이번엔 창을 안 띄워요)
  ※ lastCheckInDate를 오늘로 바꾸기 '전의' 값으로 계산해야 해요.
*/
function getVisitInfo(profile, todos) {
  const today = todayStr();
  const checkedToday = profile.lastCheckInDate === today;
  return {
    absent: !checkedToday && isLongAbsence(profile.lastCheckInDate, today),
    candidates: checkedToday ? [] : getCheckInCandidates(todos, profile.lastCheckInDate, today),
    checkedToday,
  };
}

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

// 앱을 열었을 때 첫 대사: 피곤하면 그 이유 → 다가오는 일정이 있으면 리마인드 → 단계별 인사
function getGreeting(profile, todos, absent) {
  const reason = getTiredReason(todos, { absent });
  if (reason) return pickRandom(MESSAGES.tired[reason]);
  const reminder = makeReminder(todos);
  if (reminder) return reminder.text;
  return MESSAGES.greet[STAGES[getStageIndex(profile.xp)].level];
}

// 평소 혼잣말: 피곤하면 그 이유, 전설 단계면 전설 대사, 아니면 일반 혼잣말
function getIdleLine(tiredReason, xp) {
  if (tiredReason) return pickRandom(MESSAGES.tired[tiredReason]);
  if (getStageIndex(xp) === STAGES.length - 1) return pickRandom(MESSAGES.idleLegend);
  return pickRandom(MESSAGES.idle);
}

// 이 기기에만 기억하는 설정 (혼잣말 빈도, 화면낭독기 읽기) — 저장소를 못 쓰면 기본값
function loadLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 못 해도 지금 화면에서는 동작해요 */
  }
}
const IDLE_MODE_KEY = "tamado:idleTalk"; // "often" | "sometimes" | "off"
const SR_IDLE_KEY = "tamado:srIdle"; // "1"이면 화면낭독기가 혼잣말도 읽어요

// 넘기기 대사: 같은 할 일을 여러 번 넘기면 잔소리
function getCarryMessage(count) {
  if (count >= CARRY_NAG_COUNT) return pickRandom(MESSAGES.carryNag).replace("{n}", String(count));
  return pickRandom(MESSAGES.carry);
}

export default function TodoApp({ user, initialProfile, initialTodos, initialRoutines, startOffline = false, onLogout }) {
  /* ---------- 상태 ---------- */

  // 접속 정보는 처음 한 번만 계산해요. (useState의 초기화 함수는 한 번만 실행돼요)
  const [visit] = useState(() => getVisitInfo(initialProfile, initialTodos));

  const [profile, setProfile] = useState(() =>
    // 물어볼 지난 일이 없으면 오늘 확인한 걸로 바로 기록해요.
    !visit.checkedToday && visit.candidates.length === 0
      ? { ...initialProfile, lastCheckInDate: todayStr() }
      : initialProfile
  );
  const [todos, setTodos] = useState(initialTodos);
  const [routines, setRoutines] = useState(initialRoutines);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [view, setView] = useState("todo"); // 아래쪽 패널: "todo"(할 일) | "schedule"(스케줄)
  const [bubbleText, setBubbleText] = useState(() =>
    getGreeting(initialProfile, initialTodos, visit.absent)
  );
  const [soundOn, setSoundOn] = useState(loadSoundPref);
  // 🏠 집(원래 게임기 화면)에 들어가 있는지 — 기억하지 않고, 열 때마다 화면 크기로 정해요.
  // 큰 화면(900px 이상)은 공간이 넉넉해서 게임기가 기본, 폰은 할 일이 먼저 보이게 작은 카드가 기본
  const [atHome, setAtHome] = useState(() => window.matchMedia?.("(min-width: 900px)").matches ?? false);
  const [absent, setAbsent] = useState(visit.absent); // 첫 완료를 하면 false (기운 회복)
  const [checkIn, setCheckIn] = useState(visit.candidates.length ? visit.candidates : null);
  // 게임기 각인 창: "first"(처음 안내) | "edit"(바꾸기) | null. 각인을 아직 안 물어봤으면(null) 처음 안내를 띄워요.
  const [engraveMode, setEngraveMode] = useState(() => (initialProfile.engraving == null ? "first" : null));
  const [tempMood, setTempMood] = useState(null); // 잠깐 동안만 보여 줄 표정 (happy, shocked …)
  // 아래쪽 알림 { id, text, actionLabel?, onAction?, sticky? } — 되돌리기, 저장 실패, 소리 제안
  const [toast, setToast] = useState(null);
  // 오프라인(보기 전용): 인터넷이 끊겨 기억해 둔 데이터를 보여 주는 중이면 true. 적기·체크·지우기는 막아요.
  const [offline, setOffline] = useState(startOffline);
  // 설정 (이 기기에만 기억): 혼잣말 빈도, 화면낭독기로 혼잣말 읽기
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [idleMode, setIdleMode] = useState(() => loadLocal(IDLE_MODE_KEY, "often"));
  const [srIdle, setSrIdle] = useState(() => loadLocal(SR_IDLE_KEY, "0") === "1");
  // 화면낭독기가 읽을 문장 (눈에 안 보이는 읽기 칸). 혼잣말은 srIdle이 켜졌을 때만 여기에 넣어요.
  const [announce, setAnnounce] = useState("");

  // 미니 다마고치와 카운트다운
  const [deviceVisible, setDeviceVisible] = useState(true); // 게임기 LCD가 60% 이상 보이는지
  const [miniTalking, setMiniTalking] = useState(false); // 미니 말풍선 보이기
  const [countdown, setCountdown] = useState(null); // 카운트다운 숫자 (없으면 null)
  // 카운트다운 중에는 화면 XP를 잠시 고정해서, 게임기로 올라가기 전에 진화를 들키지 않게 해요.
  const [viewHoldXp, setViewHoldXp] = useState(null);

  /* ---------- ref (다시 그려도 유지되는 값, 타이머 안에서 최신 값을 읽으려고 써요) ---------- */

  // 연출을 붙일 화면 요소
  const deviceRef = useRef(null);
  const screenRef = useRef(null);
  const bubbleRef = useRef(null);
  const petRef = useRef(null);
  const effectLayerRef = useRef(null);
  const miniBodyRef = useRef(null);
  const miniEffectsRef = useRef(null);
  const confettiRef = useRef(null);
  const petFxRefs = { screen: screenRef, bubble: bubbleRef, pet: petRef, effectLayer: effectLayerRef };

  const xpRef = useRef(initialProfile.xp); // 실제 XP (연속 클릭에도 정확하게 단계를 계산하려고)
  const soundOnRef = useRef(soundOn);
  const deviceVisibleRef = useRef(true);
  // 카운트다운으로 모으는 중인 완료 묶음. 없으면 null
  // { count: 모은 완료 개수, oldStage: 모으기 전 단계, startXp: 모으기 전 XP,
  //   remaining: 남은 초, timer: 1초 타이머, revealing: 게임기로 올라가는 중인지 }
  const batchRef = useRef(null);
  const moodTimerRef = useRef(null);
  const miniTalkTimerRef = useRef(null);
  const lastSpeakRef = useRef(0); // 마지막으로 말한 시각 (혼잣말 타이밍 계산용)
  const lastReminderRef = useRef(null); // 마지막으로 리마인드한 일정
  // 되돌리기를 기다리는 지우기: 할 일 id → { timer, commit } (5초 뒤 서버에서 지워요)
  const pendingDeletesRef = useRef(new Map());
  // effect 안에서 부를 함수 (항상 최신 버전을 가리키게 매번 바꿔 끼워요)
  const speakRef = useRef(null);
  const revealRef = useRef(null);

  /* ---------- 화면에 쓸 값 ---------- */

  const viewXp = viewHoldXp ?? profile.xp; // 카운트다운 중이면 고정된 XP
  const viewProgress = getXpProgress(viewXp);
  const pendingCount = getPendingCount(todos);
  const tiredReason = getTiredReason(todos, { absent });
  const mood = tempMood ?? (tiredReason ? "tired" : "normal");

  /* ---------- 아래쪽 알림 ---------- */

  const showToast = (t) => setToast({ ...t, id: Date.now() });
  const closeToast = useCallback(() => setToast(null), []); // Toast의 타이머가 매번 다시 걸리지 않게 고정
  const closeSettings = useCallback(() => setSettingsOpen(false), []); // 설정 창의 Esc 처리가 매번 다시 걸리지 않게 고정

  /* ---------- 오프라인 (보기 전용) ---------- */

  // 끊긴 동안 바꾸려고 하면 안내해요. 바꿨다면 true를 돌려줘요(막았음).
  function blockedOffline() {
    if (!offline) return false;
    showToast({ text: "인터넷에 연결되면 할 수 있어요 📴" });
    return true;
  }

  // 인터넷이 끊기거나 다시 연결되면 알려 줘요.
  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      setToast({ id: Date.now(), text: "인터넷이 끊겼어요. 지금은 보기만 할 수 있어요 📴", sticky: true });
    };
    const goOnline = () => {
      setOffline(false);
      setToast({
        id: Date.now(),
        text: "다시 연결됐어요! 최신 내용으로 바꿀까요?",
        actionLabel: "새로고침",
        onAction: () => window.location.reload(),
        sticky: true,
      });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // 데이터가 바뀔 때마다 이 기기에 기억해 둬요. (다음에 오프라인으로 열 때 보여 줄 데이터)
  useEffect(() => {
    if (!offline) saveSnapshot(user.uid, { profile, todos, routines });
  }, [offline, user.uid, profile, todos, routines]);

  /* ---------- 말하기, 표정, 소리 ---------- */

  // 말풍선에 대사 띄우기 (큰 말풍선 + 미니 말풍선 4초)
  // idle: 혼잣말이면 true → 화면낭독기 읽기 설정이 켜졌을 때만 읽어 줘요. 그 밖의 대답은 항상 읽어요.
  function speak(text, { idle = false } = {}) {
    setBubbleText(text);
    if (!idle || srIdle) setAnnounce(text);
    lastSpeakRef.current = Date.now();
    playAnimation(bubbleRef.current, "is-pop");
    setMiniTalking(true);
    clearTimeout(miniTalkTimerRef.current);
    miniTalkTimerRef.current = setTimeout(() => setMiniTalking(false), MINI_BUBBLE_MS);
  }

  // 표정을 잠깐 바꿨다가 원래대로 돌려요.
  function flashMood(nextMood, duration = 1400) {
    clearTimeout(moodTimerRef.current);
    setTempMood(nextMood);
    moodTimerRef.current = setTimeout(() => setTempMood(null), duration);
  }

  // 효과음 (꺼져 있으면 조용히)
  function sound(name) {
    if (soundOnRef.current) playSound(name);
  }

  // 큰 캐릭터와 미니 캐릭터에 같은 반응 애니메이션
  function animatePet(className) {
    playAnimation(petRef.current, className);
    playAnimation(miniBodyRef.current, className);
  }

  /* ---------- 연출 (기존 app.js의 8번, 10번) ---------- */

  // XP 변화 글자 띄우기: +20 XP / -10 XP (미니 다마고치가 떠 있으면 거기에도)
  function showXpChange(delta) {
    const sign = delta > 0 ? "+" : "";
    const className = `float-text${delta < 0 ? " is-minus" : ""}`;
    spawnEffect(effectLayerRef.current, className, `${sign}${delta} XP`);
    if (!deviceVisibleRef.current) spawnEffect(miniEffectsRef.current, className, `${sign}${delta}`);
  }

  // 밥 먹기 연출: 음식이 날아와서 → 냠냠 → 기뻐하기
  // count: 음식 개수 (카운트다운으로 모아 먹을 때는 여러 개가 연달아 날아와요. 최대 5개)
  // 반환값: 연출이 끝나는 데 걸리는 시간(ms) → 진화 연출을 그 뒤에 이어 붙일 때 사용
  function feedPet(count = 1) {
    const foods = Math.min(Math.max(count, 1), 5);
    const gap = 250; // 음식끼리 간격
    for (let i = 0; i < foods; i++) {
      setTimeout(() => spawnEffect(effectLayerRef.current, "food", pickRandom(FOODS)), i * gap);
    }
    const extra = (foods - 1) * gap; // 음식이 많을수록 냠냠을 늦게 시작
    setTimeout(() => {
      flashMood("eating", 1000);
      animatePet("is-eating");
    }, 650 + extra);
    setTimeout(() => {
      flashMood("happy", 1400);
      animatePet("is-happy");
    }, 1650 + extra);
    return 1700 + extra;
  }

  // 충격 연출: 덜덜 떨기 + 느낌표
  function shockPet() {
    flashMood("shocked", 1800);
    animatePet("is-shocked");
    spawnEffect(effectLayerRef.current, "shock-mark", "!");
  }

  // 진화 연출: 화면 번쩍 + 회전 + 배너 + 폭죽 + 축하 대사
  function celebrateEvolution(newStageIndex) {
    const stage = STAGES[newStageIndex];
    playAnimation(screenRef.current, "is-flash");
    animatePet("is-evolving");
    spawnEffect(effectLayerRef.current, "evolve-banner", `EVOLUTION! Lv.${stage.level}`);
    launchConfetti(confettiRef.current);
    sound("evolve");
    speak(MESSAGES.evolve[stage.level]);
  }

  // 단계가 바뀌었으면 진화/퇴화 연출을 해요. (delay: 다른 연출이 끝난 뒤에 이어서)
  function handleStageChange(oldStage, newStage, delay = 0) {
    if (newStage > oldStage) {
      setTimeout(() => celebrateEvolution(newStage), delay);
    } else if (newStage < oldStage) {
      setTimeout(() => {
        speak(MESSAGES.devolve);
        sound("devolve");
      }, delay);
    }
  }

  /* ---------- 미니 다마고치 & 완료 카운트다운 (기존 app.js의 10-1) ---------- */

  // 게임기 화면으로 부드럽게 스크롤
  function scrollToDevice() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    deviceRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  // 완료 묶음 시작: 지금 화면에 보이는 XP를 고정해서 진화를 미리 들키지 않게 해요.
  function startBatch() {
    batchRef.current = {
      count: 0,
      oldStage: getStageIndex(xpRef.current),
      startXp: xpRef.current,
      remaining: COUNTDOWN_SECONDS,
      timer: null,
      revealing: false,
    };
    setViewHoldXp(xpRef.current);
  }

  // 카운트다운을 처음부터(3초) 다시 시작
  function restartCountdown() {
    const batch = batchRef.current;
    batch.remaining = COUNTDOWN_SECONDS;
    setCountdown(batch.remaining);
    clearInterval(batch.timer);
    batch.timer = setInterval(tickCountdown, 1000);
  }

  // 1초마다 실행: 숫자를 하나씩 줄이고 0이 되면 게임기로 이동
  function tickCountdown() {
    const batch = batchRef.current;
    if (!batch) return;
    // 할 일을 수정하는 중이면 끝날 때까지 기다려요. (글 쓰다가 화면이 올라가면 불편하니까)
    if (document.querySelector(".todo-item.is-editing")) return;

    batch.remaining -= 1;
    if (batch.remaining <= 0) {
      revealBatch();
    } else {
      setCountdown(batch.remaining);
      sound("tick");
    }
  }

  // 묶음 정리: 타이머를 멈추고 화면 XP 고정을 풀어요.
  function clearBatch() {
    const batch = batchRef.current;
    if (!batch) return;
    clearInterval(batch.timer);
    batchRef.current = null;
    setViewHoldXp(null);
    setCountdown(null);
  }

  // 완료를 모두 해제해서 모은 게 0개가 되면: 화면 이동 없이 취소
  function cancelBatch() {
    const { oldStage } = batchRef.current;
    clearBatch();
    handleStageChange(oldStage, getStageIndex(xpRef.current));
  }

  // 카운트다운 끝! 게임기 화면으로 올라가서 모아 둔 반응을 한 번에 보여 줘요.
  function revealBatch() {
    const batch = batchRef.current;
    // 이미 보여 주러 가는 중이면 무시 (스크롤 중에 화면 감시가 한 번 더 부르는 것 방지)
    if (!batch || batch.revealing) return;
    batch.revealing = true;
    clearInterval(batch.timer);
    batch.timer = null;
    setCountdown(null);

    const show = () => {
      const current = batchRef.current;
      if (!current) return; // 그 사이 정리됐다면 아무것도 안 해요
      // 스크롤하는 동안 더 체크했을 수도 있으니, 보여 주는 순간의 값을 읽어요.
      const { count, oldStage, startXp } = current;
      clearBatch(); // 고정을 풀었으니 XP 게이지가 이제 차올라요

      const netXp = xpRef.current - startXp; // 모으는 동안 바뀐 XP 합계
      const duration = feedPet(count);
      sound("eat");
      if (netXp !== 0) showXpChange(netXp);
      speak(
        count >= 2
          ? `${count}개 한꺼번에 냠냠! 배 터지겠어요 😋 (${netXp >= 0 ? "+" : ""}${netXp} XP)`
          : pickRandom(MESSAGES.praise)
      );
      // 밥을 다 먹은 뒤 진화(또는 퇴화) 연출
      handleStageChange(oldStage, getStageIndex(xpRef.current), duration);
    };

    if (deviceVisibleRef.current) {
      show();
    } else {
      scrollToDevice();
      setTimeout(show, 700); // 스크롤이 끝날 즈음 연출 시작
    }
  }

  // 미니 다마고치를 눌렀을 때: 카운트다운 중이면 바로 보여 주고, 아니면 게임기로 이동
  function handleMiniPetClick() {
    if (batchRef.current) revealBatch();
    else scrollToDevice();
  }

  /* ---------- effect (화면 밖 세상과 연결) ---------- */

  // effect 안에서 쓸 함수는 항상 최신 버전을 가리키게 해요.
  useEffect(() => {
    speakRef.current = speak;
    revealRef.current = revealBatch;
  });

  // 게임기 LCD가 보이는지 감시해서 미니 다마고치를 보여 주거나 숨겨요.
  useEffect(() => {
    const el = screenRef.current;
    if (!el || !("IntersectionObserver" in window)) return; // 아주 오래된 브라우저면 항상 '보임'
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.6; // 60% 이상 보이면 '보임'
        deviceVisibleRef.current = visible;
        setDeviceVisible(visible);
        // 카운트다운 중에 사용자가 직접 위로 올라왔다면 기다리지 않고 바로 보여 줘요.
        if (visible && batchRef.current) revealRef.current?.();
      },
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [atHome]); // 카드 ↔ 게임기가 바뀌면 감시할 화면도 바뀌어서 다시 연결해요

  // 접속 인사를 한 시각부터 혼잣말 시간을 세고, 화면이 사라질 때(로그아웃 등) 타이머를 정리해요.
  useEffect(() => {
    lastSpeakRef.current = Date.now();
    const pendingDeletes = pendingDeletesRef.current;
    return () => {
      clearTimeout(moodTimerRef.current);
      clearTimeout(miniTalkTimerRef.current);
      if (batchRef.current) clearInterval(batchRef.current.timer);
      // 되돌리기를 기다리던 지우기는 화면이 사라지기 전에 바로 서버로 보내요. (로그아웃 등)
      for (const { timer, commit } of pendingDeletes.values()) {
        clearTimeout(timer);
        commit();
      }
    };
  }, []);

  // 혼잣말: 5초마다 확인해서, 설정한 시간(30초·1분) 넘게 조용했으면 다가오는 일정이나 평소 혼잣말을 해요.
  // (혼잣말 끄기면 안 하고, 다른 탭을 보고 있으면 쉬어요)
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
  }, [todos, tiredReason, idleMode]);

  // 물어볼 지난 일이 없었다면, 오늘 확인했다고 서버에도 기록해요. (접속할 때 한 번)
  const recordedVisitRef = useRef(false); // 개발 모드(StrictMode)에서 두 번 실행돼도 한 번만 보내요
  useEffect(() => {
    if (recordedVisitRef.current) return;
    recordedVisitRef.current = true;
    if (!visit.checkedToday && visit.candidates.length === 0) {
      // 접속 기록은 실패해도 다음 접속 때 다시 기록돼서, 알림 없이 기록만 남겨요.
      api.updateProfile({ lastCheckInDate: todayStr() }).catch((error) => {
        console.error("접속 날짜 기록 실패:", error.code || error);
      });
    }
    // visit 값은 접속할 때 정해지고 바뀌지 않아서, 사실상 처음 한 번만 실행돼요.
  }, [visit.checkedToday, visit.candidates.length]);

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
    if (done && !deviceVisibleRef.current && !batchRef.current) startBatch();

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
        playAnimation(miniBodyRef.current, "is-happy");
        sound("eat");
        // 이미 게임기로 올라가는 중이면 카운트다운은 다시 시작하지 않아요. (도착하면 함께 보여 줌)
        if (!batch.revealing) {
          restartCountdown();
          const bonusText = gotBonus ? " 마감 보너스 +5 🎁" : "";
          speak(`냠! ${batch.count}개째 완료!${bonusText} ${COUNTDOWN_SECONDS}초 뒤에 보러 가요 👀`);
        }
      } else {
        // 해제: 모은 걸 다 해제했으면 카운트다운 취소, 남은 게 있으면 그대로 계속
        if (batch.count <= 0 && !batch.revealing) cancelBatch();
        flashMood("shocked", 1200);
        sound("down");
        speak(pickRandom(MESSAGES.uncheck));
      }
    } else if (done) {
      // 처음 완료할 때 한 번: 효과음을 켤지 제안해요 (처음에는 꺼져 있어서)
      if (!soundOnRef.current && shouldSuggestSound()) {
        markSoundSuggested();
        showToast({ text: "냠냠 소리도 들어 볼래요? 🔊", actionLabel: "효과음 켜기", onAction: () => setSoundPref(true) });
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

  /* ---------- 🏠 집 들어가기 / 나오기 ---------- */
  // 폰: 집에 들어가면 할 일 칸을 숨기고 게임기만 보여 줘요. (CSS의 .app.is-home)
  // PC: 작은 카드 자리에 게임기가 나오고, 할 일 목록은 그 아래에 그대로 있어요.

  function handleHome(open) {
    setAtHome(open);
    sound("click");
    window.scrollTo({ top: 0 }); // 폰에서 아래쪽을 보던 중이어도 게임기가 바로 보이게
  }

  /* ---------- 설정 (이 기기에만 기억) ---------- */

  function handleIdleModeChange(mode) {
    setIdleMode(mode);
    saveLocal(IDLE_MODE_KEY, mode);
    lastSpeakRef.current = Date.now(); // 바꾼 직후 바로 말하지 않게 시간을 다시 세요
  }

  function handleSrIdleChange(on) {
    setSrIdle(on);
    saveLocal(SR_IDLE_KEY, on ? "1" : "0");
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

  /* ---------- 화면 전환 (할 일 ↔ 스케줄) ---------- */

  function handleViewChange(nextView) {
    if (nextView === view) return;
    setView(nextView);
    sound("click");
  }

  // 스케줄에서 날짜를 누르면: 그날의 할 일 화면으로 이동
  function handleOpenDate(date) {
    setSelectedDate(date);
    setView("todo");
    sound("click");
  }

  /* ---------- 게임기 버튼 ---------- */

  // A 버튼 또는 캐릭터 클릭: 쓰다듬기
  function handlePet() {
    flashMood("happy", 1200);
    animatePet("is-petted");
    spawnEffect(effectLayerRef.current, "float-text is-emoji", "💕");
    speak(tiredReason ? pickRandom(MESSAGES.tired[tiredReason]) : pickRandom(MESSAGES.pet));
    sound("click");
  }

  // B 버튼: 말 걸기 — 오늘 할 일·해낸 일·다가오는 일정·경험치 중에서 골라 이야기해요 (utils/talk.js)
  function handleTalk() {
    speak(makeTalkLine({ todos, xp: xpRef.current, tiredReason, lastLine: bubbleText }));
    sound("click");
  }

  // 효과음 켜기/끄기 (이 브라우저에 기억해요) — 설정 창과 '소리 켜기' 알림이 같이 써요
  function setSoundPref(next) {
    setSoundOn(next);
    soundOnRef.current = next;
    saveSoundPref(next);
    if (next) playSound("click");
    speak(next ? "소리를 켰어요 🔊" : "쉿, 조용히 할게요 🔇");
  }


  return (
    <>
      <main className={`app${atHome ? " is-home" : ""}`}>
        {/* 위쪽 바: 로고 + ⓘ 도움말 + 프로필 메뉴(효과음, 로그아웃) */}
        <AppHeader user={user} onOpenSettings={() => setSettingsOpen(true)} onLogout={onLogout} />
        {offline && (
          <p className="offline-banner" role="status">
            오프라인이에요 · 마지막으로 본 내용을 보여 드려요
          </p>
        )}
        {/* 다마고치: 평소엔 작은 카드, 🏠를 누르면 원래 게임기 화면 (둘 다 같은 연출 ref를 받아요) */}
        <div className="pet-slot" ref={deviceRef}>
          {atHome ? (
            <Device
              xp={viewXp}
              pendingCount={pendingCount}
              tired={!!tiredReason}
              mood={mood}
              bubbleText={bubbleText}
              onPet={handlePet}
              onTalk={handleTalk}
              onClose={() => handleHome(false)}
              engraving={profile.engraving || ""}
              onEngrave={() => setEngraveMode("edit")}
              fxRefs={petFxRefs}
            />
          ) : (
            <PetCard
              xp={viewXp}
              tired={!!tiredReason}
              mood={mood}
              bubbleText={bubbleText}
              onPet={handlePet}
              onTalk={handleTalk}
              onHome={() => handleHome(true)}
              fxRefs={petFxRefs}
            />
          )}
        </div>
        {view === "schedule" ? (
          <SchedulePanel
            todos={todos}
            routines={routines}
            tabs={<ViewTabs view={view} onChange={handleViewChange} />}
            onOpenDate={handleOpenDate}
          />
        ) : (
          <TodoPanel
            tabs={<ViewTabs view={view} onChange={handleViewChange} />}
            notice={checkIn && <CheckInCard candidates={checkIn} onResolve={handleCheckIn} />}
            todos={todos}
            routines={routines}
            selectedDate={selectedDate}
            onMoveDate={(days) => setSelectedDate((d) => addDays(d, days))}
            onToday={() => setSelectedDate(todayStr())}
            onAdd={handleAdd}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onCarry={handleCarry}
            onCarryInfo={handleCarryInfo}
            onStopRoutine={handleStopRoutine}
            onStar={handleStar}
            readOnly={offline}
            onBlocked={blockedOffline}
          />
        )}

        {/* 알림: 되돌리기, 저장 실패, 소리 제안 — 할 일 목록 바로 아래에 떠요.
            목록이 길어서 아래가 화면 밖이면 화면 아래쪽에 붙어서 보여요. (CSS position: sticky) */}
        <Toast toast={toast} onClose={closeToast} />
      </main>

      {/* 미니 다마고치 (게임기가 화면 밖으로 나가면 오른쪽 아래에 나타나요) */}
      <MiniPet
        shown={!deviceVisible}
        talking={miniTalking}
        bubbleText={bubbleText}
        countdown={countdown}
        stageIndex={viewProgress.stageIndex}
        mood={mood}
        tired={!!tiredReason}
        xpWidth={viewProgress.width}
        onClick={handleMiniPetClick}
        fxRefs={{ body: miniBodyRef, effects: miniEffectsRef }}
      />

      {/* 진화 축하 폭죽(색종이)이 떨어지는 전체 화면 레이어 */}
      <div className="confetti-layer" aria-hidden="true" ref={confettiRef} />


      {/* 설정 창 */}
      {settingsOpen && (
        <SettingsModal
          soundOn={soundOn}
          onSoundChange={setSoundPref}
          idleMode={idleMode}
          onIdleModeChange={handleIdleModeChange}
          srIdle={srIdle}
          onSrIdleChange={handleSrIdleChange}
          engraving={profile.engraving || ""}
          onEngrave={() => {
            setSettingsOpen(false);
            setEngraveMode("edit");
          }}
          onClose={closeSettings}
        />
      )}

      {/* 화면낭독기 전용 읽기 칸 (눈에는 안 보여요): 다마고치 대사를 읽어 줘요. 혼잣말은 설정에 따라 */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>


      {/* 게임기 각인 창 */}
      {engraveMode && (
        <EngraveModal
          initialText={profile.engraving || ""}
          userName={user.displayName}
          isFirst={engraveMode === "first"}
          onSave={handleEngrave}
          onClose={() => setEngraveMode(null)}
        />
      )}
    </>
  );
}
