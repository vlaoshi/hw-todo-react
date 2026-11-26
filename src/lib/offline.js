/*
  오프라인 읽기용: 마지막으로 받은 데이터를 이 기기에 사용자별로 기억해요.
  - 인터넷이 끊긴 채 앱을 열면, 이 기억해 둔 데이터를 '보기 전용'으로 보여 줘요.
  - 사용자(uid)마다 따로 저장해서, 한 기기를 여러 사람이 써도 섞이지 않아요.
  - 저장소를 못 쓰는 환경(시크릿 모드 등)에서는 조용히 넘어가요. (오프라인 보기만 안 될 뿐이에요)
*/
const key = (uid) => `tamado:snapshot:${uid}`;

// { profile, todos, routines } 저장
export function saveSnapshot(uid, data) {
  try {
    localStorage.setItem(key(uid), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    /* 저장 공간이 꽉 찼거나 저장소를 못 쓰면 건너뛰어요 */
  }
}

// 저장해 둔 데이터 (없으면 null)
export function loadSnapshot(uid) {
  try {
    const raw = localStorage.getItem(key(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 인터넷 연결 문제로 난 오류인가요? (서버가 꺼진 것과 구분하기 어려워서 둘 다 '연결 문제'로 봐요)
export function isConnectionError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const code = error?.code;
  return code === "api/network" || code === "app/timeout" || code === "auth/network-request-failed" || code === "unavailable";
}
