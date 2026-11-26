/*
  날짜 도우미 함수
  - 날짜는 "2026-11-13" 같은 글자(문자열)로 다뤄요.
    글자로 다루면 시간대 걱정이 없고, 크기 비교("2026-11-12" < "2026-11-13")도 바로 돼요.
  - 모든 날짜는 사용자 기기의 시간(한국이면 한국 시간) 기준이에요.
*/

// Date 객체 → "YYYY-MM-DD"
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" → Date 객체 (그날 0시)
export function fromDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 오늘 날짜 "YYYY-MM-DD"
export function todayStr() {
  return toDateStr(new Date());
}

// 날짜에 n일 더하기 (빼려면 음수)
export function addDays(str, n) {
  const date = fromDateStr(str);
  date.setDate(date.getDate() + n);
  return toDateStr(date);
}

// 두 날짜 사이의 일수 (to - from). 예: daysBetween("2026-11-13", "2026-11-15") = 2
export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// "2026-11-15" → "11/15"
export function formatShort(str) {
  const [, m, d] = str.split("-").map(Number);
  return `${m}/${d}`;
}

// "14:30" → "오후 2:30", "09:05" → "오전 9:05", "00:00" → "오전 12:00"
export function formatTime(str) {
  const [h, m] = str.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${hour12}:${String(m).padStart(2, "0")}`;
}

// "2026-11-13" → "11월 13일 (금)"
export function formatLong(str) {
  const date = fromDateStr(str);
  const week = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${week})`;
}
