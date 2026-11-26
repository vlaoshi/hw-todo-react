/*
  8비트 효과음 (Web Audio API)
  - 소리 파일 없이 브라우저가 직접 '삐빅' 소리를 만들어요. (기존 app.js의 "9. 8비트 효과음")
  - 효과음 켜기/끄기 설정은 이 브라우저에만 저장해요. (DB에 넣을 필요 없는 개인 설정)
  - 처음에는 꺼져 있어요. (지하철·회의 중에 갑자기 소리가 나지 않게)
    첫 완료 때 한 번만 "효과음을 켜 볼까요?"라고 제안해요. 직접 켜거나 끈 적이 있으면 그 선택을 따라요.
*/

// 효과음 종류별 음 높이(Hz)와 파형
const SOUNDS = {
  click: { notes: [880], type: "square", length: 0.05 },
  tick: { notes: [1200], type: "square", length: 0.03 }, // 카운트다운 째깍
  add: { notes: [660, 880], type: "square", length: 0.06 },
  eat: { notes: [523, 659, 784, 1047], type: "square", length: 0.07 },
  down: { notes: [440, 330], type: "triangle", length: 0.1 },
  shock: { notes: [330, 220, 165], type: "sawtooth", length: 0.09 },
  evolve: { notes: [523, 659, 784, 1047, 784, 1047, 1319], type: "square", length: 0.1 },
  devolve: { notes: [392, 330, 262, 196], type: "triangle", length: 0.12 },
};

let audioCtx = null;

export function playSound(name) {
  const sound = SOUNDS[name];
  if (!sound) return;

  try {
    // 브라우저 정책상 사용자가 클릭한 뒤에야 소리를 낼 수 있어서, 처음 필요할 때 만들어요.
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const start = audioCtx.currentTime;
    sound.notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator(); // 소리 발생기
      const gain = audioCtx.createGain(); // 볼륨 조절기
      const t = start + i * sound.length;

      osc.type = sound.type;
      osc.frequency.setValueAtTime(freq, t);
      // 작게 시작 → 짧게 울리고 → 부드럽게 꺼지기 (딱딱 끊기는 잡음 방지)
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + sound.length);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + sound.length + 0.02);
    });
  } catch (error) {
    console.warn("효과음을 재생하지 못했어요:", error);
  }
}

const SOUND_PREF_KEY = "tamado:sound";

const SOUND_ASKED_KEY = "tamado:soundAsked";

// 저장된 설정 읽기: 직접 켠 적이 있을 때만 켜짐 (처음이거나 저장소를 못 쓰면 꺼짐)
export function loadSoundPref() {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) === "on";
  } catch {
    return false;
  }
}

// "효과음을 켜 볼까요?" 제안을 해도 될까요? (직접 정한 적도, 물어본 적도 없을 때만)
export function shouldSuggestSound() {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) === null && localStorage.getItem(SOUND_ASKED_KEY) === null;
  } catch {
    return false;
  }
}

export function markSoundSuggested() {
  try {
    localStorage.setItem(SOUND_ASKED_KEY, "1");
  } catch {
    /* 저장 못 해도 괜찮아요 (다음에 한 번 더 물어볼 뿐이에요) */
  }
}

export function saveSoundPref(on) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
  } catch {
    /* 저장 못 해도 지금 화면에서는 동작해요 */
  }
}
