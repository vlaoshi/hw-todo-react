/*
  다마고치 작은 카드 (메인 화면 개선안 ①) — 평소 화면 위쪽에 보여요.
  - 캐릭터: 누르면 '교감' (지금은 쓰다듬기 반응, 진화 시스템에서 단계별 반응으로 늘릴 예정)
  - 레벨·단계 이름·XP 게이지
  - [말풍선] [💬 말 걸기] [🏠 집]  (말 걸기는 말풍선 바로 옆, 화면을 옮기는 집은 맨 끝)
    🏠 집: 캐릭터가 사는 원래 게임기 화면으로 들어가요. (폰에선 할 일 칸을 숨기고 게임기만)
    💬 말 걸기: 육성의 핵심이라 항상 보이게

  fxRefs: 연출(애니메이션, 음식, XP 글자, 진화 배너, 화면 번쩍)을 붙일 요소를 TodoApp에 알려 주는 ref 묶음
    { screen, bubble, pet, effectLayer } — 큰 게임기(Device)와 같은 이름이라 TodoApp은 둘 중 무엇이 떠 있든 똑같이 연출해요.
*/
import { getXpProgress } from "../utils/game.js";
import { HomeIcon, TalkIcon } from "./Icons.jsx";
import PixelPet from "./PixelPet.jsx";

export default function PetCard({ xp, tired = false, mood, bubbleText, onPet, onTalk, onHome, fxRefs = {} }) {
  const { screen: screenRef, bubble: bubbleRef, pet: petRef, effectLayer: effectLayerRef } = fxRefs;
  const { stageIndex, stage, percent, width, text: xpText } = getXpProgress(xp);

  return (
    <section className={`pet-card${tired ? " is-tired" : ""}`} aria-label="다마고치" ref={screenRef}>
      {/* 캐릭터: 누르면 교감 */}
      <div className="pet-card__lcd">
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
      </div>

      <div className="pet-card__info">
        <div className="pet-card__status">
          <span className="pet-card__level">Lv.{stage.level}</span>
          <span className="pet-card__stage">{stage.name}</span>
          <span className="pet-card__xp-text">{xpText}</span>
        </div>
        <div
          className="pet-card__xp"
          role="progressbar"
          aria-label="경험치"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className="pet-card__xp-fill" style={{ width }} />
        </div>

        {/* 말풍선 [💬 말 걸기] [🏠 집] (화면낭독기 읽기는 TodoApp의 숨은 읽기 칸이 맡아요) */}
        <div className="pet-card__talk">
          <p className="pet-card__bubble" ref={bubbleRef}>
            {bubbleText}
          </p>
          <button type="button" className="talk-btn" aria-label="말 걸기" onClick={onTalk}>
            <TalkIcon width={22} height={22} />
          </button>
          <button type="button" className="home-btn" aria-label="집으로 (게임기 화면)" onClick={onHome}>
            <HomeIcon width={22} height={22} />
          </button>
        </div>
      </div>

      {/* 효과 레이어: 날아오는 음식, +20 XP 글자, 진화 배너 등이 잠깐 나타나요 (fx.js가 채워요) */}
      <div className="effect-layer" aria-hidden="true" ref={effectLayerRef} />
    </section>
  );
}
