/*
  화면 연출 도우미 (기존 app.js의 playAnimation / spawnEffect / launchConfetti)
  - 잠깐 나타났다 사라지는 효과(음식, +20 XP 글자, 진화 배너, 폭죽)는 React state로 관리하면
    다시 그리기가 너무 잦아져서, 효과 전용 빈 상자(effect-layer 등)에 직접 붙였다 떼요.
  - 이 상자들은 React가 안쪽 내용을 그리지 않는 빈 요소라 직접 다뤄도 충돌하지 않아요.
*/
import { CONFETTI_COLORS } from "../constants/game.js";
import { pickRandom } from "../utils/game.js";

// 요소에 애니메이션 클래스를 붙였다가, 끝나면 자동으로 떼요. (같은 애니메이션을 연달아 재생 가능)
export function playAnimation(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth; // 브라우저가 클래스 제거를 인식하게 하는 요령 (리플로우)
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

// 효과 상자에 잠깐 나타났다 사라지는 글자/이모지 추가
export function spawnEffect(layer, className, text) {
  if (!layer) return;
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  layer.appendChild(el);
  // 애니메이션이 끝나면 스스로 지워져요. (혹시 몰라 3초 뒤에도 한 번 더 정리)
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 3000);
}

// 화면 전체에 색종이 폭죽 뿌리기
export function launchConfetti(layer, count = 90) {
  if (!layer) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    // 조각마다 위치, 크기, 속도, 회전을 랜덤으로 정해 CSS 변수로 넘겨요.
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 200}px`);
    piece.style.setProperty("--rot", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--dur", `${2.2 + Math.random() * 1.6}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.5}s`);
    piece.style.setProperty("--w", `${6 + Math.random() * 6}px`);
    piece.style.setProperty("--h", `${8 + Math.random() * 8}px`);
    piece.style.setProperty("--color", pickRandom(CONFETTI_COLORS));
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    fragment.appendChild(piece);
  }
  layer.appendChild(fragment);
  // 안전장치: 5초 뒤 남은 조각 정리
  setTimeout(() => layer.replaceChildren(), 5000);
}
