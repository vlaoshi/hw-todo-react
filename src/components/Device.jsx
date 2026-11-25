/*
  다마고치 게임기 (화면 위쪽)
  - LCD 화면: 레벨, 단계 이름, 배고픔, XP 게이지, 말풍선, 캐릭터
  - 아래쪽 A·B·C 버튼
  기존 index.html의 "1. 다마고치 게임기 영역"과 app.js의 renderStatus를 합친 컴포넌트예요.

  fxRefs: 연출(애니메이션, 날아오는 음식, 진화 배너 등)을 붙일 요소를 TodoApp에 알려 주는 ref 묶음
    { device, screen, bubble, pet, effectLayer } — 로그인 전 기본 화면처럼 연출이 없으면 생략해요.
*/
import { getXpProgress } from "../utils/game.js";
import PixelPet from "./PixelPet.jsx";

export default function Device({
  xp,
  pendingCount,
  tired = false, // 방치돼서 피곤한 상태면 true (다크서클 화면 + 배고픔 경고색)
  mood,
  bubbleText,
  soundOn,
  onPet,
  onTalk,
  onToggleSound,
  fxRefs = {},
}) {
  // 연출용 ref (없으면 undefined → 연결 안 함)
  const { device: deviceRef, screen: screenRef, bubble: bubbleRef, pet: petRef, effectLayer: effectLayerRef } = fxRefs;
  const { stageIndex, stage, percent, width, text: xpText } = getXpProgress(xp);

  return (
    <section className="device" aria-label="다마고치 게임기" ref={deviceRef}>
      {/* 게임기 위쪽 로고 */}
      <div className="device__brand">
        <span className="device__logo">TAMA-DO</span>
        <span className="device__sub">할 일을 먹고 자라요</span>
      </div>

      {/* LCD 화면 */}
      <div className={`screen${tired ? " is-tired" : ""}`} ref={screenRef}>
        {/* 상단 상태줄: 레벨 + 진화 단계 이름 + 남은 할 일 수 */}
        <div className="screen__status">
          <span className="level">Lv.{stage.level}</span>
          <span className="stage-name">{stage.name}</span>
          <span className={`hunger${tired ? " is-warning" : ""}`} title="미완료 할 일 수">
            🍽️ {pendingCount}
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

        {/* 말풍선: aria-live 덕분에 화면낭독기도 대사를 읽어줘요 */}
        <div className="bubble" aria-live="polite" ref={bubbleRef}>
          <span>{bubbleText}</span>
        </div>

        {/* 캐릭터 무대 */}
        <div className="pet-stage">
          {/* pet-wrap: 둥실둥실 떠 있는 기본 애니메이션 / pet: 기쁨·충격·진화 같은 반응 애니메이션 */}
          <div className="pet-wrap">
            <button
              type="button"
              className="pet pet-anim"
              aria-label="다마고치 쓰다듬기"
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

      {/* 게임기 아래쪽 동그란 버튼 3개 */}
      <div className="device__buttons">
        <button type="button" className="device-btn" aria-label="쓰다듬기" onClick={onPet}>
          A
        </button>
        <button type="button" className="device-btn" aria-label="말 걸기" onClick={onTalk}>
          B
        </button>
        <button
          type="button"
          className={`device-btn${soundOn ? "" : " is-off"}`}
          aria-label="소리 켜기/끄기"
          onClick={onToggleSound}
        >
          C
        </button>
      </div>
      <p className="device__hint">
        A 쓰다듬기 · B 말 걸기 · C 소리 <span>{soundOn ? "켜짐" : "꺼짐"}</span>
      </p>
    </section>
  );
}
