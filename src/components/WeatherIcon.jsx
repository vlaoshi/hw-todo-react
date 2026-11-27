/*
  날씨 픽셀 아이콘 (12×12 칸)
  - 이모지 대신 캐릭터와 같은 픽셀 그림으로 그려요. 색은 캐릭터처럼 진한 테두리(k)로 둘러요.
  - 그림은 중심과 반지름으로 계산해서 좌우 대칭이 맞아요. (칸마다 미리 적어 두지 않아요)
  - 장식용이라 화면낭독기에는 숨겨요. 글자(온도·날씨 이름)가 따로 읽혀요.

  props: kind (WEATHER_KIND의 key: clear·cloudy·rain·snow·wind·storm·hot·cold), size (화면에 보일 한 변 px)
*/
import { useMemo } from "react";

const N = 12;
const C = { y: "#ffd23f", o: "#ffa43b", r: "#ff7a59", w: "#f7fbff", d: "#cfdcea", b: "#5aa9e6", s: "#9fd3f7", g: "#8aa6c1", i: "#7ec8f0", k: "#5b4a6b" };

const blank = () => Array.from({ length: N }, () => Array(N).fill(null));
const put = (g, x, y, c) => {
  const cx = Math.round(x), cy = Math.round(y);
  if (cx >= 0 && cx < N && cy >= 0 && cy < N) g[cy][cx] = c;
};

// 원 채우기 (중심 cx, cy, 반지름 r)
function disk(g, cx, cy, r, c) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y][x] = c;
}

// 햇살: 가운데 해 + 8방향 광선
function sun(g, color, ray) {
  disk(g, 5.5, 5.5, 3, color);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    for (let t = 4.6; t <= 5.4; t += 0.4) put(g, 5.5 + Math.cos(a) * t, 5.5 + Math.sin(a) * t, ray);
  }
}

// 구름: 둥근 덩어리 세 개 + 평평한 밑면
function cloud(g, dy = 0) {
  disk(g, 3.8, 7 + dy, 2.2, C.w);
  disk(g, 7.2, 5.8 + dy, 3, C.w);
  disk(g, 9.5, 7.6 + dy, 2, C.w);
  for (let x = 2; x <= 10; x++) put(g, x, 8 + dy, C.w);
  for (let x = 2; x <= 10; x++) put(g, x, 9 + dy, C.d); // 아랫부분 그림자
}

// 바람: 두 칸 굵기의 줄 세 개 (테두리를 두르지 않아요. 줄 사이가 좁아서 테두리가 겹치기 때문이에요)
function wind(g, c) {
  const lines = [
    [2, 1, 9],
    [5, 2, 10],
    [8, 1, 8],
  ];
  for (const [y, x0, x1] of lines) {
    for (let x = x0; x <= x1; x++) {
      put(g, x, y, c);
      put(g, x, y + 1, c);
    }
  }
}

// 눈 결정: 육각 가지
function flake(g, c) {
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    for (let t = 1; t <= 4; t++) put(g, 5.5 + Math.cos(a) * t, 5.5 + Math.sin(a) * t, c);
  }
  put(g, 5.5, 5.5, c);
}

// 빗방울 두 줄
function drops(g, c) {
  for (const x of [3, 6, 9]) {
    put(g, x, 10, c);
    put(g, x - 1, 11, c);
  }
}

const DRAW = {
  clear: (g) => sun(g, C.y, C.o),
  hot: (g) => sun(g, C.r, C.o),
  cloudy: (g) => cloud(g, 1),
  rain: (g) => {
    cloud(g, -2);
    drops(g, C.b);
  },
  snow: (g) => {
    cloud(g, -2);
    for (const [x, y] of [[3, 10], [6, 10], [9, 10], [4, 11], [8, 11]]) put(g, x, y, C.s);
  },
  wind: (g) => wind(g, C.g),
  // 강풍: 진한 바람 줄 + 번개 한 개 (달처럼 보이던 소용돌이를 바꿨어요)
  storm: (g) => {
    wind(g, C.k);
    for (const [x, y] of [[9, 9], [8, 10], [9, 10], [8, 11], [7, 11]]) put(g, x, y, C.y);
  },
  cold: (g) => flake(g, C.i),
};

// 테두리: 빈 칸 중 그림과 맞닿은 칸을 진한 색으로 칠해서 캐릭터처럼 선을 둘러요
function outline(g) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      const touching = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([nx, ny]) => nx >= 0 && nx < N && ny >= 0 && ny < N && g[ny][nx]);
      if (touching) out[y][x] = C.k;
    }
  return out;
}

// 테두리를 두르지 않는 그림 (줄무늬처럼 얇은 그림)
const NO_OUTLINE = new Set(["wind", "storm"]);

export default function WeatherIcon({ kind, size = 16 }) {
  const cells = useMemo(() => {
    const g = blank();
    (DRAW[kind] ?? DRAW.cloudy)(g);
    return (NO_OUTLINE.has(kind) ? g : outline(g)).flat();
  }, [kind]);

  return (
    <span className="weather-icon" style={{ "--px": `${size / N}px` }} aria-hidden="true">
      {cells.map((color, i) => (
        <span key={i} className="px" style={{ backgroundColor: color || "transparent" }} />
      ))}
    </span>
  );
}
