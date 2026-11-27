/*
  날씨 가져오기 (Open-Meteo: 키가 필요 없어요)
  - 위치는 브라우저의 위치 권한으로 한 번 받고, 소수점 둘째 자리(약 1km)로 줄여서 요청해요. 위치는 저장하지 않아요.
  - 날씨 코드(WMO 코드)와 체감온도·바람으로 앱의 날씨 종류 하나를 골라요.
  - 오늘 남은 시간별 예보로 비·눈이 언제 오는지 알려 줘요.
  - 나중에 필요하면 기상청 단기예보·특보로 바꿀 수 있게 여기서만 Open-Meteo를 알아요.
*/
import { loadRegion } from "./api.js";
import { formatRegion } from "../utils/region.js";

const API = "https://api.open-meteo.com/v1/forecast";
const POSITION_OPTIONS = { timeout: 10000, maximumAge: 60 * 60 * 1000 };

// 앱의 날씨 종류 (이름 key, 한국어 label, 이모지 emoji)
// key는 말풍선 문장과 "말할지 말지" 판단에 쓰고, 화면 아이콘은 WeatherIcon.jsx가 key로 그려요.
const KINDS = {
  clear: { label: "맑음", emoji: "☀️" },
  cloudy: { label: "흐림", emoji: "☁️" },
  rain: { label: "비", emoji: "🌧️" },
  snow: { label: "눈", emoji: "❄️" },
  wind: { label: "바람", emoji: "💨" },
  storm: { label: "강풍", emoji: "🌀" }, // 공식 태풍 특보는 기상청 연결 단계에서 따로 붙여요
  hot: { label: "더움", emoji: "🥵" },
  cold: { label: "추움", emoji: "🥶" },
};
export const WEATHER_KIND = Object.fromEntries(Object.entries(KINDS).map(([key, v]) => [key, { key, ...v }]));

const isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
const isRain = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

// 우선순위: 눈·비 → 더움·추움(체감온도) → 강풍·바람 → 맑음·흐림
export function classify({ weather_code: code, apparent_temperature: feels, wind_speed_10m: wind }) {
  if (isSnow(code)) return WEATHER_KIND.snow;
  if (isRain(code)) return WEATHER_KIND.rain;
  if (feels >= 33) return WEATHER_KIND.hot;
  if (feels <= 0) return WEATHER_KIND.cold;
  if (wind >= 70) return WEATHER_KIND.storm;
  if (wind >= 40) return WEATHER_KIND.wind;
  return code <= 1 ? WEATHER_KIND.clear : WEATHER_KIND.cloudy;
}

// 브라우저 위치 받기. 거부하면 code: "denied"
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("no-geolocation"), { code: "unavailable" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(Object.assign(new Error("geolocation"), { code: err.code === 1 ? "denied" : "unavailable" })),
      POSITION_OPTIONS
    );
  });
}

// 한 시간의 날씨 종류 (눈·비 → 더움·추움 → 맑음·흐림)
function hourKind(code, prob, temp) {
  if (isSnow(code)) return WEATHER_KIND.snow.key;
  if (isRain(code) || prob >= 60) return WEATHER_KIND.rain.key;
  if (temp >= 33) return WEATHER_KIND.hot.key;
  if (temp <= 0) return WEATHER_KIND.cold.key;
  return code <= 1 ? WEATHER_KIND.clear.key : WEATHER_KIND.cloudy.key;
}

// 지금부터 밤 11시까지 한 시간씩: [{ hour, temp, kind }]
function summarizeHours(json, hour) {
  const { time, weather_code: codes, precipitation_probability: probs, temperature_2m: temps } = json.hourly ?? {};
  if (!time) return [];
  const out = [];
  time.forEach((stamp, i) => {
    const h = Number(stamp.slice(11, 13));
    if (h < hour) return;
    out.push({ hour: h, temp: Math.round(temps[i]), kind: hourKind(codes[i], probs[i], temps[i]) });
  });
  return out;
}

// 지금 날씨: { kind(이름), label, emoji, temp, feels, wind(km/h), hour, observedAt, rainHour, snowHour, hours, at }
export async function fetchWeather() {
  const { lat, lon } = await getPosition();
  const latKey = lat.toFixed(2); // 좌표는 약 1km 단위로 줄여서 써요
  const lonKey = lon.toFixed(2);
  // 지역 이름: 실패하거나 설정이 없으면 이름 없이 날씨만 보여 줘요
  const region = await loadRegion(latKey, lonKey)
    .then(formatRegion)
    .catch(() => null);

  const params = new URLSearchParams({
    latitude: latKey,
    longitude: lonKey,
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code", // 오늘 시간대별 예보
    forecast_days: "1",
    timezone: "auto",
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`날씨 서버 오류 ${response.status}`);
  const json = await response.json();
  const { current } = json;
  const kind = classify({
    weather_code: current.weather_code,
    apparent_temperature: current.apparent_temperature,
    wind_speed_10m: current.wind_speed_10m,
  });

  // 지금 시각 이후의 비·눈 예보 시각 (없으면 null). 비는 강수 확률 60% 이상이거나 비 코드일 때.
  const hour = Number(current.time.slice(11, 13));
  let rainHour = null;
  let snowHour = null;
  const { time, precipitation_probability: prob, weather_code: codes } = json.hourly ?? {};
  (time ?? []).forEach((stamp, i) => {
    const h = Number(stamp.slice(11, 13));
    if (h < hour) return;
    if (snowHour == null && isSnow(codes[i])) snowHour = h;
    if (rainHour == null && (isRain(codes[i]) || prob[i] >= 60)) rainHour = h;
  });

  return {
    kind: kind.key,
    label: kind.label,
    emoji: kind.emoji,
    temp: Math.round(current.temperature_2m),
    feels: Math.round(current.apparent_temperature),
    wind: current.wind_speed_10m,
    hour,
    observedAt: current.time.slice(11, 16), // 기준 시각 "10:30"
    region, // 지역 이름 "경기 광주" (없으면 null)
    rainHour,
    snowHour,
    hours: summarizeHours(json, hour),
    at: Date.now(),
  };
}
