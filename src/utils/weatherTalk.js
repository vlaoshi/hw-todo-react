/*
  날씨 한마디: 하루의 첫 날씨와 날씨가 바뀔 때 캐릭터가 말해요. (1시간마다 확인해도 같은 말을 반복하지 않아요)
  - 비·눈 예보가 있으면 그 시간을 말해요. 예보는 틀릴 수 있어서 "올 수 있다는데"로 말해요.
    (예: "오후에 비가 올 수 있다는데, 우산 챙겨야겠어요")
  - 없으면 더움·추움·바람·맑음·흐림 순서로 한마디 해요.
  - 말하는 때: 그날 처음이거나, 날씨 종류·비 시각·눈 시각이 달라졌을 때뿐이에요.
    (같은 날씨면 말풍선은 조용하고, 칩과 게임기 날씨 줄만 최신으로 바뀌어요)
*/
import { todayStr } from "./date.js";

const TALK_KEY = "tamado:weatherTalk"; // 마지막으로 말한 날씨 {day, kind, rainHour, snowHour}

// 시간을 "오전/오후/저녁"으로
export function periodOf(hour) {
  return hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";
}

// 날씨 정보(weather)로 오늘의 한마디를 만들어요. 예보 정보가 없으면 지금 날씨로만 말해요.
export function makeWeatherLine(weather) {
  const { rainHour, snowHour, hour, kind } = weather;

  if (snowHour != null) {
    return `${periodOf(snowHour)}에 눈이 올 수 있다는데, 따뜻하게 입고 나가요 ❄️`;
  }
  if (rainHour != null) {
    if (rainHour <= hour) return "지금 비가 올 수 있다는데, 우산 챙기세요 ☔";
    return `${periodOf(rainHour)}에 비가 올 수 있다는데, 우산 챙겨야겠어요 ☔`;
  }
  switch (kind) {
    case "rain":
      return "지금 비가 오고 있어요. 우산 챙기세요 ☔";
    case "snow":
      return "지금 눈이 와요. 따뜻하게 입고 나가요 ❄️";
    case "hot":
      return "오늘 많이 더워요. 물 자주 마셔요 🥵";
    case "cold":
      return "오늘 많이 추워요. 따뜻하게 입어요 🥶";
    case "storm":
      return "바람이 많이 세요. 조심해서 다녀요 🌀";
    case "wind":
      return "오늘 바람이 좀 불어요 💨";
    case "clear":
      return "오늘 날씨 좋네요 ☀️";
    default:
      return "오늘은 흐리네요 ☁️";
  }
}

// 지금 날씨를 말해야 하는지: 그날 처음이거나, 지난번 말한 뒤로 날씨가 바뀌었을 때
export function shouldSpeakWeather(weather) {
  const last = readLast();
  if (!last || last.day !== todayStr()) return true;
  return (
    last.kind !== weather.kind ||
    last.rainHour !== (weather.rainHour ?? null) ||
    last.snowHour !== (weather.snowHour ?? null)
  );
}

// 말했다고 기억해 둬요. (이 기기에만 저장해요)
export function markWeatherSpoken(weather) {
  try {
    localStorage.setItem(
      TALK_KEY,
      JSON.stringify({
        day: todayStr(),
        kind: weather.kind,
        rainHour: weather.rainHour ?? null,
        snowHour: weather.snowHour ?? null,
      })
    );
  } catch {
    /* 저장 못 해도 이번 화면에서는 같은 말을 반복하지 않아요 */
  }
}

function readLast() {
  try {
    return JSON.parse(localStorage.getItem(TALK_KEY));
  } catch {
    return null;
  }
}
