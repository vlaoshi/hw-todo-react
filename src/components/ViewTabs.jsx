/*
  화면 전환 탭: 할 일 | 스케줄
  - 할 일 패널과 스케줄 패널 맨 위에 똑같이 들어가요.
*/
const VIEWS = [
  { key: "todo", label: "할 일" },
  { key: "schedule", label: "스케줄" },
];

export default function ViewTabs({ view, onChange }) {
  return (
    <div className="view-tabs" role="tablist" aria-label="화면 전환">
      {VIEWS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          className={`view-tab${view === key ? " is-active" : ""}`}
          aria-selected={view === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
