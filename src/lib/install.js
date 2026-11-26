/*
  앱 설치(홈 화면에 추가) 도우미
  - 크롬·엣지(안드로이드, PC)는 '설치할 수 있어요' 신호(beforeinstallprompt)를 보내 줘요.
    이 파일을 불러오는 순간부터 그 신호를 받아 두었다가, 설정의 '홈 화면에 설치' 버튼에서 설치 창을 띄워요.
  - 아이폰(사파리)은 이 신호가 없어서, 공유 버튼 → '홈 화면에 추가' 방법을 안내해요.
*/
let deferredPrompt = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 브라우저가 멋대로 띄우지 않게 받아만 둬요
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

// 이미 홈 화면 앱으로 열려 있나요?
export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// 아이폰·아이패드인가요? (설치 버튼 대신 안내 문구를 보여 줘요)
export function isIOS() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// 지금 설치 창을 띄울 수 있나요?
export function canPromptInstall() {
  return !!deferredPrompt;
}

// 설치 창 띄우기 → 설치했으면 true
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null; // 한 번 쓴 신호는 다시 못 써요
  return outcome === "accepted";
}
