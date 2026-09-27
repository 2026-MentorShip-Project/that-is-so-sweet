import { useEffect, useRef, useState } from "react";
import {
  DRAFT_RESTORED,
  EventDraft,
  EventDraftFields,
  clearEventDraft,
  draftActionOnLeave,
  getEventDraft,
  saveEventDraft,
} from "../share/storage/eventDraft";

// 桌面版 CreateEvent 跟手機版 CreateWizard 是兩棵獨立的 UI 樹（不共用元件），
// 但草稿的讀寫邏輯完全一樣，抽成這個共用 hook 讓兩邊各自接自己的 state setter。
//
// 草稿只在「離開建立頁」（元件卸載，例如回上一頁／回首頁）或「關閉／離開
// 瀏覽器頁面」（pagehide）時才寫入 localStorage——打字過程中不存，送出失敗
// 也不存（表單留在畫面上、內容原封不動）。存不存由 draftActionOnLeave 決定。

export function useEventDraft(fields: EventDraftFields) {
  const [pendingDraft, setPendingDraft] = useState<EventDraft | null>(() => getEventDraft());

  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const pendingRef = useRef(pendingDraft);
  pendingRef.current = pendingDraft;
  const submittedRef = useRef(false);
  // 表單剛打開時的預設值（JSON）。不在第一次 render 就記，因為表單掛載後還會
  // 自己調整一次 state（例如「只選日期」模式會把預設 slots 改成每個日期一筆），
  // 等下一輪 event loop、表單穩定後才記。
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (baselineRef.current === null) baselineRef.current = JSON.stringify(fieldsRef.current);
    }, 0);

    const persist = () => {
      const action = draftActionOnLeave({
        hasPendingDraft: pendingRef.current !== null,
        submitted: submittedRef.current,
        baseline: baselineRef.current,
        snapshot: JSON.stringify(fieldsRef.current),
      });
      if (action === "save") saveEventDraft(fieldsRef.current);
      else if (action === "clear") clearEventDraft();
    };

    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, []);

  return {
    pendingDraft,
    // 呼叫端要先把 pendingDraft 的值套進各自的 state setter，再呼叫這個——
    // hook 不知道呼叫端的 setter 有哪些，不會自己套值。
    keepDraft: () => {
      baselineRef.current = DRAFT_RESTORED;
      setPendingDraft(null);
    },
    discardDraft: () => {
      clearEventDraft();
      setPendingDraft(null);
    },
    // 建立成功後呼叫：清掉草稿，且之後離開頁面也不再存。
    finishDraft: () => {
      submittedRef.current = true;
      clearEventDraft();
    },
  };
}
