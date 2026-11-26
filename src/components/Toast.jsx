/*
  알림 (토스트) — 할 일 목록 바로 아래에 떠요. 목록이 길면 화면 아래쪽에 붙어서 보여요.
  - 되돌리기("지웠어요 · 되돌리기"), 저장 실패("새로고침"), 소리 켜기 제안 등에 함께 써요.
  - toast: { id, text, actionLabel?, onAction?, sticky? }
      sticky가 아니면 5초 뒤 저절로 사라져요. sticky면 닫기를 누를 때까지 남아요. (저장 실패처럼 꼭 봐야 할 때)
  - role="status": 화면낭독기가 알림 내용을 읽어 줘요. (사용자가 한 동작의 결과라서 읽어 주는 게 맞아요)
*/
import { useEffect } from "react";

export const TOAST_MS = 5000;

export default function Toast({ toast, onClose }) {
  // 새 알림이 뜰 때마다(id가 바뀔 때마다) 5초를 다시 세요.
  useEffect(() => {
    if (!toast || toast.sticky) return;
    const timer = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={`toast${toast.sticky ? " is-sticky" : ""}`} role="status">
      <span className="toast__text">{toast.text}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.onAction?.();
            onClose();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button type="button" className="toast__close" aria-label="알림 닫기" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
