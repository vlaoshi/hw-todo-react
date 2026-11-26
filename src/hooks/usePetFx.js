/*
  다마고치 연출 훅 (usePetFx) — TodoApp에서 연출 부분만 그대로 옮겨 왔어요.
  ---------------------------------------------------------
  - 말하기: 말풍선 + 미니 말풍선 4초 + 화면낭독기 읽기 칸 (혼잣말은 설정에 따라)
  - 표정: 잠깐 바꿨다가 원래대로 (flashMood)
  - 효과음, 음식·XP 글자·진화 배너·폭죽 (lib/sound.js, lib/fx.js)
  - 미니 다마고치: 게임기가 화면 밖이면 오른쪽 아래에 나타나요 (IntersectionObserver)
  - 완료 카운트다운: 게임기가 안 보일 때 완료하면 3초 뒤 게임기로 올라가서 모아 둔 반응을 한 번에 보여 줘요.
    ※ XP는 체크하는 순간 바로 저장해요. 미뤄지는 건 '보여 주는 연출'뿐이에요.

  받는 값: { initialXp, initialBubble, soundOnRef, srIdle, atHome }
  돌려주는 값: 화면에 쓸 상태(bubbleText, mood 재료, 미니 펫·카운트다운), 연출을 붙일 ref, 연출 함수들
*/
import { useEffect, useRef, useState } from "react";
import { COUNTDOWN_SECONDS, FOODS, STAGES } from "../constants/game.js";
import { MESSAGES } from "../constants/messages.js";
import { getStageIndex, pickRandom } from "../utils/game.js";
import { launchConfetti, playAnimation, spawnEffect } from "../lib/fx.js";
import { playSound } from "../lib/sound.js";

// 미니 말풍선을 보여 주는 시간
const MINI_BUBBLE_MS = 4000;

export default function usePetFx({ initialXp, initialBubble, soundOnRef, srIdle, atHome }) {
  /* ---------- 상태 ---------- */
  const [bubbleText, setBubbleText] = useState(initialBubble);
  // 화면낭독기가 읽을 문장 (눈에 안 보이는 읽기 칸). 혼잣말은 srIdle이 켜졌을 때만 여기에 넣어요.
  const [announce, setAnnounce] = useState("");
  const [tempMood, setTempMood] = useState(null); // 잠깐 동안만 보여 줄 표정 (happy, shocked …)
  const [deviceVisible, setDeviceVisible] = useState(true); // 게임기 LCD가 60% 이상 보이는지
  const [miniTalking, setMiniTalking] = useState(false); // 미니 말풍선 보이기
  const [countdown, setCountdown] = useState(null); // 카운트다운 숫자 (없으면 null)
  // 카운트다운 중에는 화면 XP를 잠시 고정해서, 게임기로 올라가기 전에 진화를 들키지 않게 해요.
  const [viewHoldXp, setViewHoldXp] = useState(null);

  /* ---------- ref ---------- */
  // 연출을 붙일 화면 요소
  const deviceRef = useRef(null);
  const screenRef = useRef(null);
  const bubbleRef = useRef(null);
  const petRef = useRef(null);
  const effectLayerRef = useRef(null);
  const miniBodyRef = useRef(null);
  const miniEffectsRef = useRef(null);
  const confettiRef = useRef(null);

  const xpRef = useRef(initialXp); // 실제 XP (연속 클릭에도 정확하게 단계를 계산하려고)
  const deviceVisibleRef = useRef(true);
  // 카운트다운으로 모으는 중인 완료 묶음. 없으면 null
  // { count: 모은 완료 개수, oldStage: 모으기 전 단계, startXp: 모으기 전 XP,
  //   remaining: 남은 초, timer: 1초 타이머, revealing: 게임기로 올라가는 중인지 }
  const batchRef = useRef(null);
  const moodTimerRef = useRef(null);
  const miniTalkTimerRef = useRef(null);
  const lastSpeakRef = useRef(0); // 마지막으로 말한 시각 (혼잣말 타이밍 계산용)
  // effect 안에서 부를 함수 (항상 최신 버전을 가리키게 매번 바꿔 끼워요)
  const speakRef = useRef(null);
  const revealRef = useRef(null);

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

  /* ---------- 연출 ---------- */

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

  // 교감(캐릭터 누르기) 연출: 기뻐하며 💕
  function petReaction() {
    flashMood("happy", 1200);
    animatePet("is-petted");
    spawnEffect(effectLayerRef.current, "float-text is-emoji", "💕");
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

  /* ---------- 미니 다마고치 & 완료 카운트다운 ---------- */

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

  /* ---------- effect ---------- */

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
    return () => {
      clearTimeout(moodTimerRef.current);
      clearTimeout(miniTalkTimerRef.current);
      if (batchRef.current) clearInterval(batchRef.current.timer);
    };
  }, []);

  // 혼잣말 시간을 지금부터 다시 세요 (설정을 바꾼 직후 바로 말하지 않게)
  function resetIdleClock() {
    lastSpeakRef.current = Date.now();
  }

  return {
    // 화면에 쓸 상태
    bubbleText,
    announce,
    tempMood,
    deviceVisible,
    miniTalking,
    countdown,
    viewHoldXp,
    // 연출을 붙일 ref
    deviceRef,
    screenRef,
    bubbleRef,
    petRef,
    effectLayerRef,
    miniBodyRef,
    miniEffectsRef,
    confettiRef,
    // 다른 훅이 읽는 ref
    xpRef,
    deviceVisibleRef,
    batchRef,
    lastSpeakRef,
    speakRef,
    // 연출 함수
    speak,
    resetIdleClock,
    flashMood,
    sound,
    showXpChange,
    feedPet,
    shockPet,
    petReaction,
    handleStageChange,
    startBatch,
    restartCountdown,
    cancelBatch,
    handleMiniPetClick,
    playMiniHappy: () => playAnimation(miniBodyRef.current, "is-happy"),
  };
}
