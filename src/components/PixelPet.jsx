/*
  16×16 픽셀 캐릭터
  - 기존 app.js는 칸 256개를 직접 만들고 색을 칠했어요. (buildGrid, drawSprite)
  - React에서는 "단계 + 표정"으로 색 배열을 계산하고, 그 배열을 그대로 그려요.
    단계나 표정이 바뀔 때만 다시 계산해요. (useMemo)
*/
import { useMemo } from "react";
import { COMMON_PALETTE, FACES, STAGES } from "../constants/game.js";

// 단계 그림 + 표정 그림을 합쳐서 칸마다 색(문자)을 정해요.
function buildPixels(stageIndex, mood) {
  const stage = STAGES[stageIndex];

  // 1) 몸 그림을 2차원 배열로 복사 (원본을 망가뜨리지 않게)
  const grid = stage.sprite.map((row) => row.split(""));

  // 2) 얼굴 그림을 face 위치에 덮어쓰기 ('.'은 건너뛰어서 몸이 보이게)
  const face = FACES[mood] || FACES.normal;
  face.forEach((row, y) => {
    row.split("").forEach((char, x) => {
      if (char !== ".") grid[stage.face.y + y][stage.face.x + x] = char;
    });
  });

  // 3) 글자를 색으로 바꿔요.
  const palette = { ...COMMON_PALETTE, ...stage.palette };
  return grid.flat().map((char) => ({
    color: char === "." ? "transparent" : palette[char],
    sparkle: char === "s",
  }));
}

// mini: 미니 다마고치용 작은 그림이면 true
export default function PixelPet({ stageIndex, mood, mini = false }) {
  const pixels = useMemo(() => buildPixels(stageIndex, mood), [stageIndex, mood]);

  return (
    <span className={`pixel-grid${mini ? " pixel-grid--mini" : ""}`}>
      {pixels.map((px, i) => (
        <span
          // 칸의 위치는 절대 바뀌지 않아서 순서 번호를 key로 써도 괜찮아요.
          key={i}
          className={`px${px.sparkle ? " is-sparkle" : ""}`}
          style={{ backgroundColor: px.color }}
        />
      ))}
    </span>
  );
}
