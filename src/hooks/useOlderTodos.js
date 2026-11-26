/*
  예전 기록 더 불러오기 훅
  - 앱을 열 때는 최근 RECENT_DAYS일 기록(+ 안 끝낸 일 전부)만 불러와요. (App.jsx)
  - 그보다 예전 날짜를 보게 되면(날짜 이동, 스케줄의 이전 달) 모자란 기간만 서버에서 더 불러와 합쳐요.
  - 한 번 불러온 기간은 기억해서 다시 부르지 않아요.
  - 오프라인이면 부르지 않아요. (기억해 둔 데이터만 보여 줘요)

  받는 값: { offline, setTodos, showToast }
  돌려주는 값: ensureLoaded(date) — date 날짜부터 기록이 있게 해 줘요.
*/
import { useCallback, useEffect, useRef } from "react";
import { RECENT_DAYS } from "../constants/game.js";
import { addDays, todayStr } from "../utils/date.js";
import * as api from "../lib/api.js";

export default function useOlderTodos({ offline, setTodos, showToast }) {
  // 이 날짜(포함)부터는 이미 불러왔어요. (처음엔 App이 불러온 기간의 시작)
  const loadedFromRef = useRef(addDays(todayStr(), -RECENT_DAYS));
  const loadingRef = useRef(Promise.resolve()); // 차례로 하나씩 불러와요 (겹쳐서 두 번 부르지 않게)
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  const ensureLoaded = useCallback(
    (date) => {
      loadingRef.current = loadingRef.current.then(async () => {
        const loadedFrom = loadedFromRef.current;
        if (offlineRef.current || date >= loadedFrom) return;
        try {
          const older = await api.loadTodos({ from: date, to: loadedFrom });
          loadedFromRef.current = date;
          // 안 끝낸 일은 처음부터 불러와 있어서 겹칠 수 있어요. 이미 있는 할 일은 빼고 합쳐요.
          setTodos((list) => {
            const ids = new Set(list.map((t) => t.id));
            return [...list, ...older.filter((t) => !ids.has(t.id))];
          });
        } catch (error) {
          console.error("예전 기록 불러오기 실패:", error.code || error);
          showToast({ text: "예전 기록을 불러오지 못했어요 😢 인터넷 연결을 확인해 주세요." });
        }
      });
    },
    [setTodos, showToast]
  );

  return ensureLoaded;
}
