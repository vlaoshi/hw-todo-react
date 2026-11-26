/*
  서비스 워커: 인터넷이 끊겨도 앱 화면이 열리게 해 주는 도우미 (배포 사이트에서만 동작)
  - 앱 화면 파일(HTML, JS, CSS, 아이콘, 폰트)만 저장해요.
  - 할 일 데이터(백엔드 API)와 로그인(Firebase) 요청은 저장하지 않아요.
    → 한 기기를 여러 사람이 쓸 때 데이터가 섞이지 않게, 데이터는 앱이 사용자별로 따로 기억해요. (src/lib/offline.js)

  저장 방식
  - 페이지 이동(HTML): 먼저 인터넷에서 받아 보고, 안 되면 저장해 둔 화면을 보여 줘요. (항상 최신 화면 우선)
  - 그 밖의 파일(JS, CSS, 아이콘, 폰트): 저장해 둔 게 있으면 바로 쓰고, 뒤에서 새 파일로 바꿔 둬요.
  - 앱을 새로 배포하면 CACHE 이름의 버전을 올려요. 예전 저장분은 자동으로 지워져요.
*/
const CACHE = "tamado-shell-v1";

// 처음 설치할 때 미리 저장해 둘 기본 파일
const PRECACHE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// 저장해도 되는 다른 곳: 구글 폰트만 (백엔드·Firebase는 저장하지 않아요)
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting(); // 새 버전을 바로 쓰기 시작해요
});

self.addEventListener("activate", (event) => {
  // 예전 버전 저장분 지우기
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return; // 백엔드 API, Firebase 등은 그대로 인터넷으로

  // 페이지 이동: 인터넷 먼저, 안 되면 저장해 둔 화면
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // 그 밖의 파일: 저장분을 바로 쓰고, 뒤에서 새로 받아 바꿔 둬요
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
