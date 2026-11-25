/*
  8비트 효과음 (Web Audio API)
  - 소리 파일 없이 브라우저가 직접 '삐빅' 소리를 만들어요. (기존 app.js의 "9. 8비트 효과음")
  - 효과음 켜기/끄기 설정은 이 브라우저에만 저장해요. (DB에 넣을 필요 없는 개인 설정)
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

// 저장된 설정 읽기 (시크릿 모드 등으로 저장소를 못 쓰면 '켜짐')
export function loadSoundPref() {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundPref(on) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
  } catch {
    /* 저장 못 해도 지금 화면에서는 동작해요 */
  }
}
