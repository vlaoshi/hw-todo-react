/*
  아래쪽 알림 상태 (되돌리기, 저장 실패, 소리 제안, 오프라인 안내)
  - toast: { id, text, actionLabel?, onAction?, sticky? } 또는 null
  - showToast(내용): 새 알림 띄우기 (id는 자동으로 붙어서 같은 문구라도 타이머가 새로 걸려요)
  - closeToast(): 닫기
  두 함수는 화면을 다시 그려도 바뀌지 않아요(useCallback). 그래서 effect의 의존성에 넣어도 안전해요.
*/
import { useCallback, useState } from "react";

export default function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((t) => setToast({ ...t, id: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);
  return { toast, showToast, closeToast };
}
