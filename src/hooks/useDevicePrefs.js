/*
  이 기기에만 기억하는 설정 (서버에 저장하지 않아요)
  - 효과음 켜기/끄기 (lib/sound.js가 저장)
  - 혼잣말 빈도: "often"(자주 30초) | "sometimes"(가끔 1분) | "off"(끄기)
  - 화면낭독기로 혼잣말 읽기: true/false
  기기마다 다를 수 있는 설정이라(폰은 화면낭독기 켜고 PC는 끄는 등) 이 브라우저에만 기억해요.
  저장소를 못 쓰는 환경(시크릿 모드 등)에서는 기본값으로 동작해요.
*/
import { useRef, useState } from "react";
import { loadSoundPref, saveSoundPref } from "../lib/sound.js";

const IDLE_MODE_KEY = "tamado:idleTalk";
const SR_IDLE_KEY = "tamado:srIdle"; // "1"이면 화면낭독기가 혼잣말도 읽어요
const WEATHER_ON_KEY = "tamado:weatherOn"; // "1"이면 날씨를 보여 줘요 (위치를 써서 기본은 꺼 둬요)

function loadLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 못 해도 지금 화면에서는 동작해요 */
  }
}

export default function useDevicePrefs() {
  const [soundOn, setSoundOnState] = useState(loadSoundPref);
  // 타이머 안(카운트다운 째깍 등)에서도 최신 값을 읽으려고 ref에도 같이 둬요.
  const soundOnRef = useRef(soundOn);
  const [idleMode, setIdleModeState] = useState(() => loadLocal(IDLE_MODE_KEY, "often"));
  const [srIdle, setSrIdleState] = useState(() => loadLocal(SR_IDLE_KEY, "0") === "1");
  const [weatherOn, setWeatherOnState] = useState(() => loadLocal(WEATHER_ON_KEY, "0") === "1");

  function setSound(on) {
    setSoundOnState(on);
    soundOnRef.current = on;
    saveSoundPref(on);
  }

  function setIdleMode(mode) {
    setIdleModeState(mode);
    saveLocal(IDLE_MODE_KEY, mode);
  }

  function setSrIdle(on) {
    setSrIdleState(on);
    saveLocal(SR_IDLE_KEY, on ? "1" : "0");
  }

  function setWeatherOn(on) {
    setWeatherOnState(on);
    saveLocal(WEATHER_ON_KEY, on ? "1" : "0");
  }

  return { soundOn, soundOnRef, setSound, idleMode, setIdleMode, srIdle, setSrIdle, weatherOn, setWeatherOn };
}
