/*
  다마고치 게임기 — 🏠 '집' 화면 (평소에는 작은 카드 PetCard를 보여 줘요)
  - 위쪽: 내가 새긴 각인 (예: '작심 30년!'), 없으면 기본 로고
  - LCD 화면: 레벨, 단계 이름, 배고픔, XP 게이지, 말풍선, 캐릭터 (캐릭터를 눌러도 교감)
  - 아래쪽 버튼 줄: ❤️ 교감 · 💬 말 걸기 · 작게 보기 — 모두 같은 모양 (C 소리는 프로필 메뉴로 옮겼어요)
    앞으로 진화·액세서리·꾸미기 버튼이 이 줄에 늘어날 예정이라, 여러 개면 줄바꿈되는 구조예요.
  기존 index.html의 "1. 다마고치 게임기 영역"과 app.js의 renderStatus를 합친 컴포넌트예요.

  fxRefs: 연출(애니메이션, 날아오는 음식, 진화 배너 등)을 붙일 요소를 TodoApp에 알려 주는 ref 묶음
    { device, screen, bubble, pet, effectLayer } — 로그인 전 기본 화면처럼 연출이 없으면 생략해요.
*/
import { getXpProgress } from "../utils/game.js";
import { BackIcon, BowlIcon, HeartIcon, TalkIcon } from "./Icons.jsx";
import PixelPet from "./PixelPet.jsx";

export default function Device({
  xp,
  pendingCount,
  tired = false, // 방치돼서 피곤한 상태면 true (다크서클 화면 + 배고픔 경고색)
  mood,
  bubbleText,
  engraving = "", // 게임기에 새긴 문구 (없으면 기본 로고)
  onPet,
  onTalk,
  onClose, // 집에서 나가 작은 카드로 (로그인 전 기본 화면처럼 없으면 버튼 줄을 숨겨요)
  onEngrave, // 각인을 눌렀을 때 (바꾸기 창 열기)
  fxRefs = {},
}) {
  // 연출용 ref (없으면 undefined → 연결 안 함)
  const { device: deviceRef, screen: screenRef, bubble: bubbleRef, pet: petRef, effectLayer: effectLayerRef } = fxRefs;
  const { stageIndex, stage, percent, width, text: xpText } = getXpProgress(xp);

  return (
    <section className="device" aria-label="다마고치 게임기" ref={deviceRef}>
      {/* 게임기 위쪽: 내가 새긴 각인 (없으면 기본 로고). onEngrave가 있으면 눌러서 바꿀 수 있어요 */}
      <div className="device__brand">
        {engraving ? (
          onEngrave ? (
            <button type="button" className="engraving engraving--btn" aria-label={`게임기 각인 바꾸기: ${engraving}`} onClick={onEngrave}>
              {engraving}
            </button>
          ) : (
            <span className="engraving">{engraving}</span>
          )
        ) : (
          <>
            <span className="device__logo">TAMA-DO</span>
            <span className="device__sub">할 일을 먹고 자라요</span>
          </>
        )}
      </div>

      {/* LCD 화면 */}
      <div className={`screen${tired ? " is-tired" : ""}`} ref={screenRef}>
        {/* 상단 상태줄: 레벨 + 진화 단계 이름 + 남은 할 일 수 */}
        <div className="screen__status">
          <span className="level">Lv.{stage.level}</span>
          <span className="stage-name">{stage.name}</span>
          <span className={`hunger${tired ? " is-warning" : ""}`} title="남은 할 일 수">
            <BowlIcon width={16} height={16} /> {pendingCount}
          </span>
        </div>

        {/* 경험치(XP) 게이지 바 */}
        <div className="xp">
          <div
            className="xp__bar"
            role="progressbar"
            aria-label="경험치"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <div className="xp__fill" style={{ width }} />
          </div>
          <span className="xp__text">{xpText}</span>
        </div>

        {/* 말풍선 (화면낭독기 읽기는 TodoApp의 숨은 읽기 칸이 맡아요: 혼잣말은 설정에 따라) */}
        <div className="bubble" ref={bubbleRef}>
          <span>{bubbleText}</span>
        </div>

        {/* 캐릭터 무대 */}
        <div className="pet-stage">
          {/* pet-wrap: 둥실둥실 떠 있는 기본 애니메이션 / pet: 기쁨·충격·진화 같은 반응 애니메이션 */}
          <div className="pet-wrap">
            <button
              type="button"
              className="pet pet-anim"
              aria-label="다마고치와 교감하기"
              data-stage={stageIndex + 1}
              onClick={onPet}
              ref={petRef}
            >
              <PixelPet stageIndex={stageIndex} mood={mood} />
            </button>
          </div>
          <div className="pet-shadow" />
        </div>

        {/* 효과 레이어: 날아오는 음식, +20 XP 글자, 진화 배너 등이 잠깐 나타나요 (fx.js가 채워요) */}
        <div className="effect-layer" aria-hidden="true" ref={effectLayerRef} />
      </div>

      {/* 게임기 아래쪽 버튼 줄: 교감 · 말 걸기 · 작게 보기 (나중에 진화·상점·꾸미기 버튼이 여기에 늘어나요) */}
      {onClose && (
        <div className="device__actions">
          <button type="button" className="device-action device-action--pet" onClick={onPet}>
            <HeartIcon width={20} height={20} /> 교감
          </button>
          <button type="button" className="device-action device-action--talk" onClick={onTalk}>
            <TalkIcon width={20} height={20} /> 말 걸기
          </button>
          <button type="button" className="device-action" onClick={onClose}>
            <BackIcon width={18} height={18} /> 작게 보기
          </button>
        </div>
      )}
    </section>
  );
}
