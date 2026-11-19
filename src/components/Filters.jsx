/*
  필터 버튼: 전체 / 진행중 / 완료 (+ 개수)
*/
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "active", label: "진행중" },
  { key: "done", label: "완료" },
];

export default function Filters({ filter, counts, onChange }) {
  return (
    <div className="filters" role="group" aria-label="할 일 필터">
      {FILTERS.map(({ key, label }) => {
        const active = key === filter;
        return (
          <button
            key={key}
            type="button"
            className={`filter${active ? " is-active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(key)}
          >
            {label} <span className="filter__count">{counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
