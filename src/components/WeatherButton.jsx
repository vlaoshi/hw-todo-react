/*
  날씨 버튼: 아이콘 + 온도만 보여 주고, 누르면 상세 창(팝오버)이 열려요.
  - variant "tag": 큰 게임기 상태줄 (레벨·단계 옆)
  - variant "chip": 작은 카드 (캐릭터 상자 위)
  - 팝오버는 화면 위(포털)에 띄워서, 카드나 게임기의 테두리에 잘리지 않아요.
  - Esc, 바깥 누르기, 스크롤·화면 크기 변경으로 닫혀요. 닫으면 버튼으로 포커스가 돌아가요.
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WeatherIcon from "./WeatherIcon.jsx";
import WeatherDetail from "./WeatherDetail.jsx";

const POPOVER_WIDTH = 300;
const EDGE = 8;

export default function WeatherButton({ weather, variant = "tag" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const headingRef = useRef(null);

  function toggle() {
    if (open) return setOpen(false);
    const r = buttonRef.current.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE * 2);
    // 화면 밖으로 나가지 않게 왼쪽 위치를 조정해요
    const left = Math.min(Math.max(EDGE, r.left), window.innerWidth - width - EDGE);
    setPos({ top: r.bottom + 8, left, width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus(); // 화면낭독기가 "오늘 날씨"부터 읽게

    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    const close = () => setOpen(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!weather) return null;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className={variant === "chip" ? "weather-chip" : "weather-tag"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`오늘 날씨 자세히 보기: ${weather.label} ${weather.temp}도`}
        onClick={toggle}
      >
        <WeatherIcon kind={weather.kind} size={16} />
        <span aria-hidden="true">{weather.temp}°</span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="popover weather-popover"
            role="dialog"
            aria-label="오늘 날씨"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <WeatherDetail weather={weather} headingRef={headingRef} />
          </div>,
          document.body
        )}
    </>
  );
}
