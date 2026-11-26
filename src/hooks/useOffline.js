/*
  오프라인(보기 전용) 훅
  - offline: 인터넷이 끊겨 기억해 둔 데이터를 보여 주는 중이면 true (적기·체크·지우기를 막아요)
  - blockedOffline(): 끊긴 동안 바꾸려고 하면 "인터넷에 연결되면 할 수 있어요"를 띄우고 true(막았음)를 돌려줘요.
  - 인터넷이 끊기거나 다시 연결되면 알림으로 알려 줘요. (다시 연결되면 '새로고침' 제안)
  - 데이터가 바뀔 때마다 이 기기에 사용자별로 기억해 둬요. (다음에 오프라인으로 열 때 보여 줄 데이터)

  받는 값: { startOffline, uid, profile, todos, routines, showToast }
*/
import { useEffect, useState } from "react";
import { saveSnapshot } from "../lib/offline.js";

export default function useOffline({ startOffline, uid, profile, todos, routines, showToast }) {
  const [offline, setOffline] = useState(startOffline);

  function blockedOffline() {
    if (!offline) return false;
    showToast({ text: "인터넷에 연결되면 할 수 있어요 📴" });
    return true;
  }

  // 인터넷이 끊기거나 다시 연결되면 알려 줘요.
  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      showToast({ text: "인터넷이 끊겼어요. 지금은 보기만 할 수 있어요 📴", sticky: true });
    };
    const goOnline = () => {
      setOffline(false);
      showToast({
        text: "다시 연결됐어요! 최신 내용으로 바꿀까요?",
        actionLabel: "새로고침",
        onAction: () => window.location.reload(),
        sticky: true,
      });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [showToast]);

  // 데이터가 바뀔 때마다 이 기기에 기억해 둬요.
  useEffect(() => {
    if (!offline) saveSnapshot(uid, { profile, todos, routines });
  }, [offline, uid, profile, todos, routines]);

  return { offline, blockedOffline };
}
