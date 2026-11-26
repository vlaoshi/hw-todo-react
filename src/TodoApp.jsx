/*
  다마고치 투두 - 로그인한 뒤의 게임 화면
  ---------------------------------------------------------
  - 로그인한 사용자(user)와 로그아웃 함수(onLogout)는 App이 넘겨줘요.
  - 처음 데이터(initialProfile, initialTodos, initialRoutines)는 App이 백엔드에서 불러와서 넘겨줘요.
    (오늘의 반복 할 일은 App이 불러오기 전에 미리 만들어 둬요)

  이 파일은 '연결'만 해요. 실제 일은 역할별 훅이 맡아요.
    hooks/useToast.js        아래쪽 알림
    hooks/useDevicePrefs.js  이 기기에만 기억하는 설정 (효과음, 혼잣말 빈도, 화면낭독기)
    hooks/usePetFx.js        다마고치 연출 (말하기, 표정, 소리, 음식·진화, 미니 펫, 3초 카운트다운)
    hooks/useIdleTalk.js     혼잣말·리마인드
    hooks/useOffline.js      오프라인(보기 전용), 데이터 기억
    hooks/useOlderTodos.js   예전 기록 더 불러오기 (처음엔 최근 30일만 불러와요)
    hooks/useTodoActions.js  할 일 동작 (추가·완료·지우기·되돌리기·넘기기·별표·수정·지난 일·각인)

  다마고치 기분
  - 할 일을 추가하면 기뻐해요. (할 일 = 먹을 밥!)
  - 피곤함은 '방치'됐을 때만: 오랜만의 접속 / 마감 지난 일 / 저녁까지 완료 0개 (utils/game.js의 getTiredReason)
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { STAGES } from "./constants/game.js";
import { MESSAGES } from "./constants/messages.js";
import { addDays, todayStr } from "./utils/date.js";
import {
  getCheckInCandidates,
  getPendingCount,
  getStageIndex,
  getTiredReason,
  getXpProgress,
  isLongAbsence,
  pickRandom,
} from "./utils/game.js";
import { makeReminder } from "./utils/reminders.js";
import { makeTalkLine } from "./utils/talk.js";
import { playSound } from "./lib/sound.js";
import * as api from "./lib/api.js";
import useDevicePrefs from "./hooks/useDevicePrefs.js";
import useIdleTalk from "./hooks/useIdleTalk.js";
import useOffline from "./hooks/useOffline.js";
import useOlderTodos from "./hooks/useOlderTodos.js";
import usePetFx from "./hooks/usePetFx.js";
import useToast from "./hooks/useToast.js";
import useTodoActions from "./hooks/useTodoActions.js";
import AppHeader from "./components/AppHeader.jsx";
import CheckInCard from "./components/CheckInCard.jsx";
import EngraveModal from "./components/EngraveModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import Device from "./components/Device.jsx";
import MiniPet from "./components/MiniPet.jsx";
import PetCard from "./components/PetCard.jsx";
import SchedulePanel from "./components/SchedulePanel.jsx";
import TodoPanel from "./components/TodoPanel.jsx";
import Toast from "./components/Toast.jsx";
import ViewTabs from "./components/ViewTabs.jsx";

/*
  접속했을 때 한 번만 정하는 값
  - absent      : 오랜만의 접속인가요? (지난 접속일이 2일 이상 전)
  - candidates  : '지난 일 가져오기' 카드에 보여 줄 할 일 (없으면 빈 배열)
  - checkedToday: 오늘 이미 물어봤으면 true (이번엔 카드를 안 띄워요)
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

// 앱을 열었을 때 첫 대사: 피곤하면 그 이유 → 다가오는 일정이 있으면 리마인드 → 단계별 인사
function getGreeting(profile, todos, absent) {
  const reason = getTiredReason(todos, { absent });
  if (reason) return pickRandom(MESSAGES.tired[reason]);
  const reminder = makeReminder(todos);
  if (reminder) return reminder.text;
  return MESSAGES.greet[STAGES[getStageIndex(profile.xp)].level];
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
  // 🏠 집(원래 게임기 화면)에 들어가 있는지 — 기억하지 않고, 열 때마다 화면 크기로 정해요.
  // 큰 화면(900px 이상)은 공간이 넉넉해서 게임기가 기본, 폰은 할 일이 먼저 보이게 작은 카드가 기본
  const [atHome, setAtHome] = useState(() => window.matchMedia?.("(min-width: 900px)").matches ?? false);
  const [absent, setAbsent] = useState(visit.absent); // 첫 완료를 하면 false (기운 회복)
  const [checkIn, setCheckIn] = useState(visit.candidates.length ? visit.candidates : null);
  // 게임기 각인 창: "first"(처음 안내) | "edit"(바꾸기) | null. 각인을 아직 안 물어봤으면(null) 처음 안내를 띄워요.
  const [engraveMode, setEngraveMode] = useState(() => (initialProfile.engraving == null ? "first" : null));
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ---------- 역할별 훅 연결 (앞의 훅을 뒤의 훅이 써요) ---------- */

  const { soundOn, soundOnRef, setSound, idleMode, setIdleMode, srIdle, setSrIdle } = useDevicePrefs();
  const { toast, showToast, closeToast } = useToast();
  const fx = usePetFx({
    initialXp: initialProfile.xp,
    initialBubble: getGreeting(initialProfile, initialTodos, visit.absent),
    soundOnRef,
    srIdle,
    atHome,
  });
  const { offline, blockedOffline } = useOffline({ startOffline, uid: user.uid, profile, todos, routines, showToast });
  const ensureLoaded = useOlderTodos({ offline, setTodos, showToast });

  // 보고 있는 날짜가 불러온 기간보다 예전이면 그 기록을 더 불러와요.
  useEffect(() => {
    ensureLoaded(selectedDate);
  }, [selectedDate, ensureLoaded]);

  /* ---------- 화면에 쓸 값 ---------- */

  const viewXp = fx.viewHoldXp ?? profile.xp; // 카운트다운 중이면 고정된 XP
  const viewProgress = getXpProgress(viewXp);
  const pendingCount = getPendingCount(todos);
  const tiredReason = getTiredReason(todos, { absent });
  const mood = fx.tempMood ?? (tiredReason ? "tired" : "normal");
  const { bubbleText, announce, deviceVisible, miniTalking, countdown, handleMiniPetClick } = fx;
  const { deviceRef, miniBodyRef, miniEffectsRef, confettiRef } = fx;
  const petFxRefs = { screen: fx.screenRef, bubble: fx.bubbleRef, pet: fx.petRef, effectLayer: fx.effectLayerRef };

  useIdleTalk({
    idleMode,
    todos,
    tiredReason,
    xpRef: fx.xpRef,
    lastSpeakRef: fx.lastSpeakRef,
    speakRef: fx.speakRef,
  });

  // 효과음 켜기/끄기 (이 브라우저에 기억해요) — 설정 창과 '소리 켜기' 알림이 같이 써요
  function setSoundPref(next) {
    setSound(next);
    if (next) playSound("click");
    fx.speak(next ? "소리를 켰어요 🔊" : "쉿, 조용히 할게요 🔇");
  }

  const {
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
  } = useTodoActions({
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
    onSuggestSound: () => setSoundPref(true),
  });

  const closeSettings = useCallback(() => setSettingsOpen(false), []); // 설정 창의 Esc 처리가 매번 다시 걸리지 않게 고정

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

  /* ---------- 🏠 집 들어가기 / 나오기 ---------- */
  // 폰: 집에 들어가면 할 일 칸을 숨기고 게임기만 보여 줘요. (CSS의 .app.is-home)
  // PC: 작은 카드 자리에 게임기가 나오고, 할 일 목록은 그 아래에 그대로 있어요.
  function handleHome(open) {
    setAtHome(open);
    fx.sound("click");
    window.scrollTo({ top: 0 }); // 폰에서 아래쪽을 보던 중이어도 게임기가 바로 보이게
  }

  /* ---------- 설정 (이 기기에만 기억) ---------- */
  function handleIdleModeChange(mode) {
    setIdleMode(mode);
    fx.resetIdleClock(); // 바꾼 직후 바로 말하지 않게 시간을 다시 세요
  }

  function handleSrIdleChange(on) {
    setSrIdle(on);
  }

  /* ---------- 화면 전환 (할 일 ↔ 스케줄) ---------- */
  function handleViewChange(nextView) {
    if (nextView === view) return;
    setView(nextView);
    fx.sound("click");
  }

  // 스케줄에서 날짜를 누르면: 그날의 할 일 화면으로 이동
  function handleOpenDate(date) {
    setSelectedDate(date);
    setView("todo");
    fx.sound("click");
  }

  /* ---------- 게임기 버튼 ---------- */

  // 캐릭터 누르기 또는 교감 버튼
  function handlePet() {
    fx.petReaction();
    fx.speak(tiredReason ? pickRandom(MESSAGES.tired[tiredReason]) : pickRandom(MESSAGES.pet));
    fx.sound("click");
  }

  // 말 걸기 — 오늘 할 일·해낸 일·다가오는 일정·경험치 중에서 골라 이야기해요 (utils/talk.js)
  function handleTalk() {
    fx.speak(makeTalkLine({ todos, xp: fx.xpRef.current, tiredReason, lastLine: bubbleText }));
    fx.sound("click");
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
            onNeedDate={ensureLoaded}
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
