/*
  백엔드 저장소 (localhost:5050 → MongoDB)
  ---------------------------------------------------------
  기존 app.js의 apiRequest + BackendStore를 옮겼어요.
  - 요청할 때마다 Firebase 로그인 토큰을 Authorization 헤더에 담아 보내요.
    백엔드는 이 토큰을 검사해서 '누구의 데이터인지' 확인해요.
  - 백엔드 주소는 .env의 VITE_API_BASE로 바꿀 수 있어요. (없으면 localhost:5050)
  - 백엔드가 5173 주소의 요청을 받으려면 백엔드 .env의 CORS_ORIGINS에 5173이 있어야 해요.

  ▶ 함수 목록 (모두 async)
    loadProfile()                 프로필 { xp, stage, lastCheckInDate } (없으면 서버가 기본값으로 만들어 줘요)
    updateProfile({ xpDelta, lastCheckInDate })  보낸 것만 반영
    loadTodos()                   할 일 목록 (최신순)
    addTodo(todo)                 할 일 추가
    updateTodo(id, patch)         할 일의 일부 내용만 수정
    deleteTodo(id)                할 일 삭제
    resetAll()                    할 일과 프로필 모두 삭제 (초기화 버튼)

  ▶ XP를 '변화량'으로 보내는 이유
    완료를 빠르게 여러 번 누르면 서버에 요청이 도착하는 순서가 뒤바뀔 수 있어요.
    "XP를 120으로 저장" 대신 "XP +20"으로 보내면 순서와 상관없이 결과가 정확해요.
*/
import { auth } from "./firebase.js";
import { appError, withTimeout } from "./auth.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050/api";

// 서버가 한 번에 받는 XP 변화량 한도 (백엔드의 XP_DELTA_LIMIT과 같게)
const XP_DELTA_LIMIT = 100;

// 서버가 수정을 허용하는 필드 (백엔드의 EDITABLE_FIELDS와 같게)
const TODO_EDITABLE_FIELDS = ["text", "done", "date", "dueDate", "carryCount", "bonusXp"];

// 백엔드에 요청 보내기. 실패하면 code가 붙은 오류를 던져요.
//   api/network : 서버가 꺼져 있거나 연결할 수 없음 (CORS에 막혀도 이 오류예요)
//   api/400, api/401, api/403, api/404, api/500 … : 서버가 보낸 오류 상태 코드
async function apiRequest(path, { method = "GET", body } = {}) {
  const user = auth.currentUser;
  if (!user) throw appError("api/401");

  // 로그인 토큰: 아직 유효하면 저장된 것을, 만료됐으면 Firebase가 새로 받아 줘요.
  const token = await user.getIdToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await withTimeout(
      fetch(API_BASE + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    );
  } catch (error) {
    if (error.code === "app/timeout") throw error;
    throw appError("api/network");
  }

  if (response.status === 204) return null; // 삭제 성공 등 '내용 없음' 응답
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = appError(`api/${response.status}`);
    error.serverMessage = data && data.message; // 서버가 알려 준 이유 (예: 검증 실패 내용)
    throw error;
  }
  return data;
}

// 서버의 할 일 → 앱에서 쓰는 모양
// (서버는 시각을 "2026-11-16T01:03:00.000Z" 같은 글자로 보내고, 앱은 숫자(밀리초)로 다뤄요)
function fromServerTodo(todo) {
  return {
    ...todo,
    createdAt: Date.parse(todo.createdAt) || Date.now(),
    updatedAt: Date.parse(todo.updatedAt) || Date.now(),
    completedAt: todo.completedAt ? Date.parse(todo.completedAt) : null,
  };
}

/*
  새 할 일의 아이디 처리
  - 할 일을 추가하면 화면에는 바로 보여 주고(앱이 만든 임시 아이디), 서버 저장은 뒤에서 해요.
  - 서버는 자기만의 아이디를 새로 정해서 돌려줘요.
  - 서버 저장이 끝나기 전에 체크·삭제를 눌러도 되도록, 저장이 끝날 때까지 기다렸다가
    서버 아이디로 바꿔서 요청해요.
*/
const serverIds = new Map(); // 앱 아이디 → 서버 아이디
const pending = new Map(); // 앱 아이디 → 서버 저장이 끝나기를 기다리는 Promise

async function toServerId(id) {
  if (pending.has(id)) await pending.get(id).catch(() => {});
  return serverIds.get(id) || id;
}

export function loadProfile() {
  return apiRequest("/profile");
}

// 프로필 변경. XP 변화량이 한도(±100)를 넘으면 나눠서 보내요.
export async function updateProfile({ xpDelta = 0, lastCheckInDate } = {}) {
  const base = lastCheckInDate !== undefined ? { lastCheckInDate } : {};
  let remaining = xpDelta;
  do {
    const step = Math.max(-XP_DELTA_LIMIT, Math.min(XP_DELTA_LIMIT, remaining));
    remaining -= step;
    await apiRequest("/profile", {
      method: "PATCH",
      body: step ? { ...base, xpDelta: step } : base,
    });
  } while (remaining !== 0);
}

// 내 할 일 전체 (서버가 최신순으로 보내 줘요)
export async function loadTodos() {
  const todos = await apiRequest("/todos");
  return todos.map(fromServerTodo);
}

// 할 일 추가 (서버는 text, date, dueDate만 받고 나머지는 기본값으로 만들어요)
export async function addTodo(todo) {
  const saving = apiRequest("/todos", {
    method: "POST",
    body: { text: todo.text, date: todo.date, dueDate: todo.dueDate },
  }).then((saved) => {
    serverIds.set(todo.id, saved.id);
  });
  pending.set(todo.id, saving);
  try {
    await saving;
  } finally {
    pending.delete(todo.id);
  }
}

// 할 일 수정: 서버가 허용하는 필드만 골라서 보내요. (완료 시각 등은 서버가 알아서 정해요)
export async function updateTodo(id, patch) {
  const body = {};
  for (const field of TODO_EDITABLE_FIELDS) {
    if (field in patch) body[field] = patch[field];
  }
  if (Object.keys(body).length === 0) return;
  const serverId = await toServerId(id);
  await apiRequest(`/todos/${encodeURIComponent(serverId)}`, { method: "PATCH", body });
}

export async function deleteTodo(id) {
  const serverId = await toServerId(id);
  await apiRequest(`/todos/${encodeURIComponent(serverId)}`, { method: "DELETE" });
}

// 초기화: 내 할 일 전체 삭제 + 프로필 삭제
export async function resetAll() {
  await apiRequest("/todos", { method: "DELETE" });
  await apiRequest("/profile", { method: "DELETE" });
  serverIds.clear();
}
