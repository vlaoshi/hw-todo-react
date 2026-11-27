/*
  날씨 훅: 설정에서 '날씨 보기'를 켰을 때만 날씨를 가져와요.
  - 1시간마다 새로 받고, 그 사이에는 이 기기에 저장해 둔 값을 써요. (인터넷이 끊겨도 마지막 날씨를 보여 줘요)
  - 위치 권한을 거부하면 조용히 숨기고, 설정 창에 이유를 알려 줘요. (status: "denied")

  받는 값: enabled (설정에서 켰는지)
  돌려주는 값: { weather, status }  status: "off" | "loading" | "ok" | "denied" | "error"
*/
import { useEffect, useState } from "react";
import { fetchWeather } from "../lib/weather.js";

const CACHE_KEY = "tamado:weather";
const TTL = 60 * 60 * 1000; // 날씨는 천천히 바뀌어서 1시간에 한 번이면 충분해요

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    // 예전 형식(시간별 예보·지역 이름 항목이 없는 값)은 버리고 새로 받아요
    const fresh =
      cached && cached.data && typeof cached.data.kind === "string" && Array.isArray(cached.data.hours) && "region" in cached.data;
    return fresh ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: data.at, data }));
  } catch {
    /* 저장 못 해도 지금 화면에서는 보여 줘요 */
  }
}

export default function useWeather(enabled) {
  const [state, setState] = useState(() => ({ weather: readCache()?.data ?? null, status: "loading" }));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const cached = readCache();
      if (cached && Date.now() - cached.at < TTL) {
        setState({ weather: cached.data, status: "ok" });
        return;
      }
      try {
        const data = await fetchWeather();
        if (cancelled) return;
        writeCache(data);
        setState({ weather: data, status: "ok" });
      } catch (error) {
        if (cancelled) return;
        console.error("날씨 불러오기 실패:", error.code || error.message);
        const denied = error.code === "denied";
        setState((prev) => ({
          weather: denied ? null : prev.weather ?? readCache()?.data ?? null,
          status: denied ? "denied" : "error",
        }));
      }
    };

    load();
    const timer = setInterval(load, TTL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled) return { weather: null, status: "off" };
  return state;
}
