/*
  지역 이름 만들기: 행정구역 세 단계를 화면용 한 줄로 바꿔요.
  - 시·구: "경기 광주", "경기 수원 장안"  (시·구 이름까지)
  - 군: 읍·면이면 "경기 양평 옥천읍", 아니면 "경기 양평"
  - 광역 이름은 짧게: 경기도 → 경기, 서울특별시 → 서울, 경상북도 → 경북
*/
const SHORT = [
  ["경상북", "경북"],
  ["경상남", "경남"],
  ["충청북", "충북"],
  ["충청남", "충남"],
  ["전라북", "전북"],
  ["전라남", "전남"],
];

function provinceName(name) {
  const base = name.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "");
  const hit = SHORT.find(([long]) => base.startsWith(long));
  return hit ? hit[1] : base;
}

// "수원시 장안구" → "수원 장안", "광주시" → "광주" (시·군·구 글자만 뺌, 읍·면·동은 그대로)
const withoutUnit = (name) =>
  name
    .split(" ")
    .map((part) => part.replace(/(시|군|구)$/, ""))
    .join(" ");

export function formatRegion({ province = "", city = "", town = "" } = {}) {
  const p = province ? provinceName(province) : "";
  if (!city) return [p, town].filter(Boolean).join(" ") || null;

  const lastWord = city.split(" ").pop();
  if (/(시|구)$/.test(lastWord)) return [p, withoutUnit(city)].filter(Boolean).join(" ");

  // 군: 아래 행정구역이 읍·면이면 읍·면까지 보여 줘요
  const townPart = town && /(읍|면)$/.test(town) ? town : null;
  return [p, withoutUnit(city), townPart].filter(Boolean).join(" ");
}
