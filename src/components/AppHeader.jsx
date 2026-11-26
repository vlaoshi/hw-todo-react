/*
  위쪽 바: 로고 + ⓘ 도움말 + 프로필 메뉴 (메인 화면 개선안 ⑥⑦)
  - ⓘ 도움말: '경험치 규칙' · '진화 단계' 제목만 보이고, 마우스를 올리거나(PC) 누르면(폰) 내용이 펼쳐져요
  - 프로필 메뉴: 사용자 이름, 설정(소리·혼잣말·각인·접근성), 로그아웃 (예전 C 버튼과 아래쪽 로그아웃을 옮겼어요)
  - 메뉴는 바깥을 누르거나 Esc를 누르면 닫혀요.
*/
import { useEffect, useRef, useState } from "react";
import { STAGES, XP_RULES } from "../constants/game.js";
import { ChevronDown, ChevronRight, InfoIcon } from "./Icons.jsx";

// 도움말 제목 두 줄 (내용은 펼쳤을 때만 보여요)
const HELP_SECTIONS = [
  { key: "rules", title: "경험치 규칙" },
  { key: "stages", title: "진화 단계" },
];

const RULES = [
  { label: "할 일 완료", value: `+${XP_RULES.COMPLETE}` },
  { label: "마감일까지 완료하면 보너스", value: `+${XP_RULES.DUE_BONUS}` },
  { label: "다음 날로 넘기기 (반복 할 일은 넘기기 없음)", value: `${XP_RULES.CARRY}` },
  { label: "포기하고 지우기", value: `${XP_RULES.GIVE_UP}` },
  { label: "필요 없어져서 지우기", value: "0" },
];

export default function AppHeader({ user, onOpenSettings, onLogout }) {
  const [open, setOpen] = useState(null); // "help" | "profile" | null
  const [helpSection, setHelpSection] = useState(null); // 도움말에서 펼친 칸: "rules" | "stages" | null
  const wrapRef = useRef(null);

  // 메뉴가 열려 있을 때만: 바깥을 누르거나 Esc를 누르면 닫아요.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(null);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (name) => {
    setOpen((cur) => (cur === name ? null : name));
    setHelpSection(null); // 도움말은 열 때마다 제목만 보이게
  };
  const initial = (user.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <header className="app-header" ref={wrapRef}>
      <span className="app-header__logo">TAMA-DO</span>

      <div className="app-header__actions">
        <button
          type="button"
          className="header-btn"
          aria-label="도움말: XP 규칙"
          aria-expanded={open === "help"}
          aria-controls="helpPopover"
          onClick={() => toggle("help")}
        >
          <InfoIcon width={22} height={22} />
        </button>
        <button
          type="button"
          className="header-btn"
          aria-label="프로필 메뉴"
          aria-expanded={open === "profile"}
          aria-controls="profileMenu"
          onClick={() => toggle("profile")}
        >
          <span className={`avatar${open === "profile" ? " is-open" : ""}`}>{initial}</span>
        </button>
      </div>

      {/* ⓘ 도움말: 제목 두 줄만 보이고, PC는 마우스를 올리면 · 폰은 누르면 그 내용이 펼쳐져요 (한 번에 하나) */}
      {open === "help" && (
        <div className="popover popover--help" id="helpPopover" role="dialog" aria-label="도움말">
          {HELP_SECTIONS.map((sec) => {
            const expanded = helpSection === sec.key;
            return (
              <div key={sec.key} className={`help-item${expanded ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="help-item__head"
                  aria-expanded={expanded}
                  aria-controls={`help-${sec.key}`}
                  // 마우스: 올리면 펼침 / 터치·키보드: 누를 때마다 펼치고 접기
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHelpSection(sec.key)}
                  onClick={() => setHelpSection(expanded ? null : sec.key)}
                >
                  {sec.title}
                  {expanded ? <ChevronDown width={18} height={18} /> : <ChevronRight width={18} height={18} />}
                </button>
                {expanded && (
                  <div className="help-item__body" id={`help-${sec.key}`}>
                    {sec.key === "rules" ? (
                      <ul className="rule-list">
                        {RULES.map((r) => (
                          <li key={r.label}>
                            <span>{r.label}</span>
                            <strong className={r.value.startsWith("-") ? "is-minus" : ""}>{r.value}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ol className="stage-list">
                        {STAGES.map((st) => (
                          <li key={st.level}>
                            <span>
                              Lv.{st.level} {st.name}
                            </span>
                            <span>{st.minXp} XP</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 프로필 메뉴 */}
      {open === "profile" && (
        <div className="popover popover--menu" id="profileMenu" role="menu" aria-label="프로필 메뉴">
          <span className="menu-user">{user.displayName} 님</span>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(null);
              onOpenSettings();
            }}
          >
            설정
          </button>
          <button type="button" role="menuitem" className="menu-item menu-item--danger" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}
