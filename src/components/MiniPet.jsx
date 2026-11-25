/*
  미니 다마고치 (오른쪽 아래)
  - 할 일 목록을 보느라 게임기가 화면 밖으로 나가면 나타나서 따라다녀요.
  - 다마고치가 말하면 4초 동안 미니 말풍선으로도 보여 줘요. (혼잣말 포함)
  - 할 일을 완료하면 3초 카운트다운 숫자를 보여 주고, 0이 되면 게임기 화면으로 올라가요.
  - 누르면 바로 게임기 화면으로 이동해요.
  기존 index.html의 mini-pet 마크업과 CSS를 그대로 써요.

  fxRefs: { body, effects } — 반응 애니메이션과 +20 같은 글자를 붙일 요소
*/
import PixelPet from "./PixelPet.jsx";

export default function MiniPet({
  shown, // 게임기가 안 보이면 true
  talking, // 미니 말풍선을 보여 줄지
  bubbleText,
  countdown, // 카운트다운 숫자 (없으면 null)
  stageIndex,
  mood,
  tired,
  xpWidth, // 미니 XP 게이지 너비 ("40%")
  onClick,
  fxRefs = {},
}) {
  // 연출용 ref
  const { body: bodyRef, effects: effectsRef } = fxRefs;
  const className = ["mini-pet", shown && "is-shown", talking && "is-talking", tired && "is-tired"]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      aria-label="게임기 화면으로 이동"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      onClick={onClick}
    >
      {/* 미니 말풍선 */}
      <span className="mini-pet__bubble">{bubbleText}</span>

      {/* 카운트다운 숫자 배지 (key를 바꿔서 숫자가 바뀔 때마다 톡 튀는 애니메이션을 다시 재생해요) */}
      {countdown !== null && (
        <span key={countdown} className="mini-pet__countdown is-pop">
          {countdown}
        </span>
      )}

      {/* 작은 캐릭터 */}
      <span className="mini-pet__body pet-anim" data-stage={stageIndex + 1} ref={bodyRef}>
        <PixelPet stageIndex={stageIndex} mood={mood} mini />
      </span>

      {/* 작은 XP 게이지 */}
      <span className="mini-pet__xp">
        <span className="mini-pet__xp-fill" style={{ width: xpWidth }} />
      </span>

      {/* +20 XP 같은 글자가 떠오르는 곳 (fx.js가 채워요) */}
      <span className="mini-pet__effects" aria-hidden="true" ref={effectsRef} />
    </button>
  );
}
