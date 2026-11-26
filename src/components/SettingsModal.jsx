/*
  설정 창 (프로필 메뉴 → 설정)
  - 소리: 효과음 켜기/끄기
  - 다마고치: 혼잣말 빈도 (자주 30초 · 가끔 1분 · 끄기), 게임기 각인 바꾸기
  - 접근성: 화면낭독기로 혼잣말 읽기 (VoiceOver·TalkBack 같은 화면낭독기를 쓸 때만 해당)
      내가 한 동작에 대한 대답(완료 칭찬, 말 걸기)은 항상 읽어 주고, 이 설정은 혼잣말만 정해요.
  - 이 설정들은 기기마다 다를 수 있어서(폰은 화면낭독기 켜고 PC는 끄는 등) 이 기기에만 기억해요.
  - 모양은 '지난 일 가져오기' 창과 같은 CSS(.checkin)를 써요.
*/
import { useEffect, useRef } from "react";

const IDLE_MODES = [
  { key: "often", label: "자주", hint: "30초" },
  { key: "sometimes", label: "가끔", hint: "1분" },
  { key: "off", label: "끄기", hint: "" },
];

// 켜기/끄기 한 줄
function SwitchRow({ label, desc, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="setting-row" onClick={() => onChange(!checked)}>
      <span className="setting-row__text">
        <span className="setting-row__label">{label}</span>
        {desc && <span className="setting-row__desc">{desc}</span>}
      </span>
      <span className={`switch${checked ? " is-on" : ""}`} aria-hidden="true" />
    </button>
  );
}

export default function SettingsModal({
  soundOn,
  onSoundChange,
  idleMode,
  onIdleModeChange,
  srIdle,
  onSrIdleChange,
  engraving,
  onEngrave,
  onClose,
}) {
  const cardRef = useRef(null);

  // 창이 열리면 창 자체에 포커스(화면낭독기가 '설정'부터 읽어요), Esc로 닫기
  useEffect(() => {
    cardRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="checkin" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="checkin__card settings" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" tabIndex={-1} ref={cardRef}>
        <div className="settings__head">
          <h2 className="checkin__title" id="settingsTitle">
            설정
          </h2>
          <button type="button" className="settings__close" aria-label="설정 닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="settings__group" aria-labelledby="setSound">
          <h3 className="settings__group-title" id="setSound">
            소리
          </h3>
          <SwitchRow label="효과음" desc="완료, 진화 때 8비트 소리" checked={soundOn} onChange={onSoundChange} />
        </section>

        <section className="settings__group" aria-labelledby="setPet">
          <h3 className="settings__group-title" id="setPet">
            다마고치
          </h3>
          <div className="setting-row setting-row--static">
            <span className="setting-row__text">
              <span className="setting-row__label" id="idleLabel">
                혼잣말
              </span>
              <span className="setting-row__desc">가만히 있을 때 다마고치가 말을 거는 빈도</span>
            </span>
          </div>
          <div className="segmented" role="radiogroup" aria-labelledby="idleLabel">
            {IDLE_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={idleMode === m.key}
                className={`segmented__btn${idleMode === m.key ? " is-on" : ""}`}
                onClick={() => onIdleModeChange(m.key)}
              >
                {m.label}
                {m.hint && <small> {m.hint}</small>}
              </button>
            ))}
          </div>
          <button type="button" className="setting-row" onClick={onEngrave}>
            <span className="setting-row__text">
              <span className="setting-row__label">게임기 각인</span>
              <span className="setting-row__desc">{engraving ? `'${engraving}'` : "아직 새기지 않았어요"}</span>
            </span>
            <span className="setting-row__go" aria-hidden="true">
              바꾸기 ›
            </span>
          </button>
        </section>

        <section className="settings__group" aria-labelledby="setA11y">
          <h3 className="settings__group-title" id="setA11y">
            접근성
          </h3>
          <SwitchRow
            label="화면낭독기로 혼잣말 읽기"
            desc="VoiceOver·TalkBack을 쓸 때 혼잣말도 소리 내어 읽어요. 내가 한 동작에 대한 대답은 항상 읽어 줘요."
            checked={srIdle}
            onChange={onSrIdleChange}
          />
        </section>

        <p className="checkin__note">이 설정은 이 기기에만 저장돼요</p>
      </div>
    </div>
  );
}
