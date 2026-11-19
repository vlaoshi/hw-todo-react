/* =========================================================
   게임 설정 (XP 규칙, 진화 단계, 픽셀 그림)
   - 기존 app.js의 "1. 게임 설정"을 그대로 옮겼어요.
   ========================================================= */

// XP 규칙: 숫자만 바꾸면 게임 밸런스가 바뀌어요
export const XP_RULES = {
  COMPLETE: 20, // 할 일 완료 시 +20
  UNCHECK: -20, // 완료 해제 시 -20 (회수)
  GIVE_UP: -10, // 미완료 할 일 삭제(포기) 시 -10
  CARRY: -5, // 할 일을 다음 날(또는 오늘)로 넘길 때마다 -5
  DUE_BONUS: 5, // 마감일 당일까지 완료하면 보너스 +5 (해제하면 함께 회수)
};

// 같은 할 일을 이 횟수 이상 넘기면 다마고치가 잔소리를 해요.
export const CARRY_NAG_COUNT = 3;

// '오늘 못 한 일 + 마감 지난 일'이 이 개수 이상이면 '다크서클/배고픔' 상태
export const TIRED_THRESHOLD = 5;

// 할 일 글자 수 제한 (백엔드 Todo 모델의 maxlength와 같게)
export const MAX_TEXT_LENGTH = 60;

// 게임기가 안 보일 때 완료하면 몇 초 기다렸다가 게임기 화면으로 올라갈지
export const COUNTDOWN_SECONDS = 3;

/*
  픽셀 그림 읽는 법
  - 한 줄은 16글자, 모두 16줄 = 16×16 픽셀 그림이에요.
  - 글자 하나가 픽셀 한 칸이고, 글자마다 색이 정해져 있어요.
    '.' 투명   'k' 테두리   'b' 몸 색   'l' 몸 밝은 부분   'w' 흰색/배
    'p' 볼터치  'd' 다크서클  'r' 빨강    'g' 금색   'c' 망토   's' 반짝이
  - 얼굴(눈, 입)은 따로 그려서 face 위치(x, y)에 덧붙여요. 그래서 표정만 바꿀 수 있어요.
*/

// 모든 단계가 함께 쓰는 공통 색
export const COMMON_PALETTE = {
  k: "#5b4a6b", // 테두리 (진한 보라 회색)
  w: "#ffffff",
  p: "#ffb3c6", // 볼터치
  d: "#8e7cc3", // 다크서클
  r: "#ff6b8b",
  g: "#ffd166",
  s: "#fff3a3",
};

// 진화 5단계 정보
export const STAGES = [
  {
    level: 1,
    name: "알",
    minXp: 0,
    face: { x: 4, y: 5 }, // 얼굴을 붙일 위치 (왼쪽 위 기준)
    palette: { w: "#fff6e0", l: "#ffffff", b: "#ffc8dd" },
    sprite: [
      "................",
      "......kkkk......",
      "....kkwwwwkk....",
      "...kwwwwwwwwk...",
      "...kwlwwwwwwk...",
      "..kwlwwwwwwwwk..",
      "..kwwwwwwwwwwk..",
      "..kwwwwwwwwwwk..",
      "..kwwwwwwwwwwk..",
      "..kwwwwwwwwwwk..",
      "..kbwbwbwbwbwk..",
      "..kwbwbwbwbwbk..",
      "...kwwwwwwwwk...",
      "....kkwwwwkk....",
      "......kkkk......",
      "................",
    ],
  },
  {
    level: 2,
    name: "아기",
    minXp: 40,
    face: { x: 4, y: 6 },
    palette: { b: "#ffe39a", l: "#fff6cf" },
    sprite: [
      "................",
      "................",
      "................",
      ".....kkkkkk.....",
      "....kbbbbbbk....",
      "...kbllbbbbbk...",
      "..kblbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "...kbbbbbbbbk...",
      "....kkkkkkkk....",
      ".....kk..kk.....",
      "................",
      "................",
    ],
  },
  {
    level: 3,
    name: "청소년",
    minXp: 100,
    face: { x: 4, y: 5 },
    palette: { b: "#a8e6cf", l: "#d8f8ea" },
    sprite: [
      "....k......k....",
      ".....k....k.....",
      ".....kkkkkk.....",
      "....kbbbbbbk....",
      "...kbbbbbbbbk...",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      ".kkbbbbbbbbbbkk.",
      "kbkbbbbbbbbbbkbk",
      ".k.kbbbbbbbbk.k.",
      "....kkkkkkkk....",
      "....kbk..kbk....",
      "....kkk..kkk....",
    ],
  },
  {
    level: 4,
    name: "어른",
    minXp: 180,
    face: { x: 4, y: 4 },
    palette: { b: "#ffb5a7", l: "#ffd9d0", w: "#fff1ec" },
    sprite: [
      "..kk........kk..",
      "..kbk......kbk..",
      "..kbbkkkkkkbbk..",
      "..kbbbbbbbbbbk..",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      "kkbbbwwwwwwbbbkk",
      "kbkbwwwwwwwwbkbk",
      ".k.kbwwwwwwbk.k.",
      "...kkbbbbbbkk...",
      "...kbbk..kbbk...",
      "...kkkk..kkkk...",
    ],
  },
  {
    level: 5,
    name: "전설의 갓생 다마고치",
    minXp: 280,
    face: { x: 4, y: 5 },
    palette: { b: "#cdb4db", l: "#eadcf3", c: "#ff8fab" },
    sprite: [
      "s...g..gg..g..s.",
      "....gggggggg....",
      "....grggggrg....",
      "...kkkkkkkkkk...",
      "..kbbbbbbbbbbk..",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      ".kbbbbbbbbbbbbk.",
      "kckbbbbbbbbbbkck",
      "kcckbbbbbbbbkcck",
      "kccckbbbbbbkccck",
      ".kkkkbbbbbbkkkk.",
      "....kbbk..kbbk..",
      "s...kkkk..kkkk.s",
    ],
  },
];

// 표정(얼굴) 그림: 가로 8칸 × 세로 5칸. '.'은 몸 색이 그대로 보여요.
export const FACES = {
  // 보통
  normal: [".k....k.", ".k....k.", "p......p", "........", "...kk..."],
  // 기쁨: ^ ^ 눈 + 웃는 입
  happy: [".k....k.", "k.k..k.k", "p......p", "..k..k..", "...kk..."],
  // 냠냠: 입을 크게 벌림
  eating: [".k....k.", "k.k..k.k", "p......p", "..kkkk..", "..krrk.."],
  // 충격: 동그랗게 커진 눈 + 소리치는 입
  shocked: ["kk....kk", "kk....kk", "........", "..kkkk..", "..krrk.."],
  // 다크서클/배고픔: 반쯤 감긴 눈 + 다크서클 + 시무룩한 입
  tired: ["........", "kkk..kkk", "ddd..ddd", "...kk...", "..k..k.."],
};

// 완료할 때 먹는 음식들
export const FOODS = ["🍎", "🍰", "🍙", "🍩", "🍓", "🍪"];

// 폭죽 색종이 색
export const CONFETTI_COLORS = ["#ffc8dd", "#cdb4db", "#a8e6cf", "#ffe5a3", "#bde0fe", "#ff8fab"];
