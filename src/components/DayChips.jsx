/*
  반복 요일 고르기: 매일 / 월 화 수 목 금 토 일
  - 할 일 추가 폼과 수정 모드가 함께 써요.
  - days: 고른 요일 번호 배열 (0 일 ~ 6 토), onChange(새 배열)
  - keepFocus: 수정 모드처럼 '포커스가 밖으로 나가면 저장'하는 곳에서는 true
    → 칩을 눌러도 입력칸의 포커스를 뺏지 않아요. (사파리는 버튼을 눌러도 포커스를 주지 않아서
      그대로 두면 수정 모드가 저장되며 닫혀 버려요)
*/

// 화면에 보여 줄 요일 순서: 월요일부터 (값은 자바스크립트 요일 번호)
const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];
const ALL_DAYS = WEEKDAYS.map((d) => d.value);

export default function DayChips({ days, onChange, keepFocus = false }) {
  const isEveryDay = days.length === ALL_DAYS.length;
  const noFocusSteal = keepFocus ? { onMouseDown: (e) => e.preventDefault() } : {};

  function toggleDay(value) {
    onChange(days.includes(value) ? days.filter((d) => d !== value) : [...days, value]);
  }

  return (
    <div className="repeat-days" role="group" aria-label="반복할 요일">
      {/* "매일": 전부 골라져 있으면 모두 해제, 아니면 모두 선택 */}
      <button
        type="button"
        className={`day-chip day-chip--all${isEveryDay ? " is-on" : ""}`}
        aria-pressed={isEveryDay}
        onClick={() => onChange(isEveryDay ? [] : ALL_DAYS)}
        {...noFocusSteal}
      >
        매일
      </button>
      {WEEKDAYS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`day-chip${days.includes(value) ? " is-on" : ""}`}
          aria-pressed={days.includes(value)}
          onClick={() => toggleDay(value)}
          {...noFocusSteal}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
