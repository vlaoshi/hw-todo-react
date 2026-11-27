/*
  날씨 상세 내용 (팝오버 안에 들어가요)
  - 지금: 아이콘, 온도, 날씨 이름, 체감·바람, 기준 시각
  - 오늘: 오전·오후·저녁 세 칸 (지난 시간대는 흐리게), 비·눈이 올 수 있는 시간
  - 예보는 바뀔 수 있다는 안내를 항상 붙여요.
*/
import WeatherIcon from "./WeatherIcon.jsx";
import { WEATHER_KIND } from "../lib/weather.js";
import { periodOf } from "../utils/weatherTalk.js";

// 15 → "오후 3시"
function hourLabel(hour) {
  return `${periodOf(hour)} ${hour % 12 || 12}시`;
}

export default function WeatherDetail({ weather, headingRef }) {
  const { label, temp, feels, wind, observedAt, hours, rainHour, snowHour, hour, region } = weather;
  const windMs = Math.round(wind / 3.6);
  // 2시간마다 한 칸: 지금 → +2시간 → +4시간 … (데이터는 한 시간씩 받아 두고 여기서 골라요)
  const shown = hours ? hours.filter((_, i) => i % 2 === 0) : [];
  // 막대 높이를 정하는 기준: 보이는 칸 중 가장 낮은 온도와 가장 높은 온도
  const hourTemps = shown.map((h) => h.temp);
  const minTemp = Math.min(...hourTemps);
  const maxTemp = Math.max(...hourTemps);
  const span = maxTemp - minTemp || 1;

  // 비·눈이 올 수 있는 시간 한 줄 (예보라서 "올 수 있어요"로 말해요)
  let note = null;
  if (snowHour != null) note = `${hourLabel(snowHour)}쯤 눈이 올 수 있어요`;
  else if (rainHour != null) note = rainHour <= hour ? "지금 비가 올 수 있어요" : `${hourLabel(rainHour)}쯤 비가 올 수 있어요`;

  return (
    <div className="weather-detail">
      <div className="weather-detail__head">
        <h3 className="weather-detail__title" tabIndex={-1} ref={headingRef}>
          오늘 날씨
        </h3>
        {region && <span className="weather-detail__region">({region})</span>}
      </div>

      <div className="weather-detail__now">
        <WeatherIcon kind={weather.kind} size={44} />
        <div>
          <strong className="weather-detail__temp">
            {temp}° <span>{label}</span>
          </strong>
          <small>
            체감 {feels}° · 바람 {windMs}m/s
          </small>
        </div>
      </div>

      {note && <p className="weather-detail__note">{note}</p>}

      {/* 오늘 남은 시간: 2시간마다, 막대 높이가 기온을 보여 줘요. 화면 너비에 맞춰 칸을 나눠요. */}
      {shown.length > 0 && (
        <section className="weather-detail__hours" aria-label="오늘 남은 시간별 날씨 (2시간마다)">
          <ol className="weather-detail__hour-list" style={{ "--n": shown.length }}>
            {shown.map((h) => {
              const barHeight = 18 + ((h.temp - minTemp) / span) * 40;
              return (
                <li key={h.hour} className={`weather-detail__hour${h.hour === hour ? " is-now" : ""}`}>
                  <span className="weather-detail__hour-temp">{h.temp}°</span>
                  {/* 막대 칸은 높이가 고정돼 있고 막대는 아래에 붙어요. 그래서 아이콘 줄이 모두 같은 높이에 맞아요. */}
                  <span className="weather-detail__bar-area">
                    <span className="weather-detail__bar" style={{ height: `${barHeight}px` }} />
                  </span>
                  <WeatherIcon kind={h.kind} size={20} />
                  <span className="weather-detail__hour-time">{h.hour === hour ? "지금" : `${h.hour}시`}</span>
                  <span className="sr-only">{WEATHER_KIND[h.kind]?.label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <p className="weather-detail__foot">
        기준 {observedAt} · 예보는 바뀔 수 있어요 · 날씨: Open-Meteo
      </p>
    </div>
  );
}
