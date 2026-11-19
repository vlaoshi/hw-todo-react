/*
  다마고치 게임기 (화면 위쪽)
  - LCD 화면: 레벨, 단계 이름, 배고픔, XP 게이지, 말풍선, 캐릭터
  - 아래쪽 A·B·C 버튼
  기존 index.html의 "1. 다마고치 게임기 영역"과 app.js의 renderStatus를 합친 컴포넌트예요.
*/
import { STAGES, TIRED_THRESHOLD } from "../constants/game.js";
import { getStageIndex } from "../utils/game.js";
import PixelPet from "./PixelPet.jsx";

export default function Device({
  xp,
  pendingCount,
  mood,
  bubbleText,
  soundOn,
  onPet,
  onTalk,
  onToggleSound,
}) {
  const stageIndex = getStageIndex(xp);
  const stage = STAGES[stageIndex];
  const next = STAGES[stageIndex + 1];
  const tired = pendingCount >= TIRED_THRESHOLD;

  // 게이지: 현재 단계 시작점 ~ 다음 단계 시작점 사이에서 얼마나 왔는지 (%)
  const percent = next ? ((xp - stage.minXp) / (next.minXp - stage.minXp)) * 100 : 100;
  const width = `${Math.min(100, Math.max(0, percent))}%`;
  const xpText = next ? `${xp} / ${next.minXp} XP` : `${xp} XP MAX`;

  return (
    <section className="device" aria-label="다마고치 게임기">
      {/* 게임기 위쪽 로고 */}
      <div className="device__brand">
        <span className="device__logo">TAMA-DO</span>
        <span className="device__sub">할 일을 먹고 자라요</span>
      </div>

      {/* LCD 화면 */}
      <div className={`screen${tired ? " is-tired" : ""}`}>
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
        <div className="bubble" aria-live="polite">
          <span>{bubbleText}</span>
        </div>

        {/* 캐릭터 무대 */}
        <div className="pet-stage">
          <div className="pet-wrap">
            <button
              type="button"
              className="pet pet-anim"
              aria-label="다마고치 쓰다듬기"
              data-stage={stageIndex + 1}
              onClick={onPet}
            >
              <PixelPet stageIndex={stageIndex} mood={mood} />
            </button>
          </div>
          <div className="pet-shadow" />
        </div>

        {/* 효과 레이어: 날아오는 음식, +20 XP 글자 등 (5단계에서 채워요) */}
        <div className="effect-layer" aria-hidden="true" />
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
