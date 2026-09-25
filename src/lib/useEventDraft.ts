import { useEffect, useRef, useState } from "react";
import { EventDraft, EventDraftFields, clearEventDraft, getEventDraft, saveEventDraft } from "./eventDraft";

// 桌面版 CreateEvent 跟手機版 CreateWizard 是兩棵獨立的 UI 樹（不共用元件），
// 但草稿的讀寫/凍結邏輯完全一樣，抽成這個共用 hook 讓兩邊各自接自己的
// state setter，不用各寫一份。

const RESTORED = "__restored__";

export function useEventDraft(fields: EventDraftFields) {
  const [pendingDraft, setPendingDraft] = useState<EventDraft | null>(() => getEventDraft());
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  // 表單剛打開時的預設值。內容跟它一模一樣就不算草稿——否則只是打開建立表單
  // 什麼都沒填就離開，下次也會跳「偵測到未完成的草稿」。不在第一次 render 就
  // 記錄，因為表單掛載後還會自己調整一次 state（例如「只選日期」模式會把預設
  // slots 改成每個日期一筆），要等第一次 debounce 觸發、表單穩定後才記。
  // 套用舊草稿後設成 RESTORED，之後一律照存，不跟預設值比。
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    // 有舊草稿還沒讓使用者決定「繼續編輯」或「捨棄」之前，不能自動存
    // 目前（預設值）表單狀態，否則會在使用者做出選擇前就把舊草稿蓋掉。
    if (pendingDraft) return;
    const timer = setTimeout(() => {
      const snapshot = JSON.stringify(fieldsRef.current);
      if (baselineRef.current === null) {
        baselineRef.current = snapshot;
        return;
      }
      if (snapshot === baselineRef.current) clearEventDraft();
      else saveEventDraft(fieldsRef.current);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fields.title,
    fields.hostName,
    fields.description,
    fields.mode,
    fields.responseDeadline,
    fields.locationInput,
    JSON.stringify(fields.location),
    JSON.stringify(fields.selectedDates),
    JSON.stringify(fields.slots),
    pendingDraft,
  ]);

  return {
    pendingDraft,
    // 呼叫端要先把 pendingDraft 的值套進各自的 state setter，再呼叫這個
    // 解除「凍結」，讓 autosave 從套用後的值繼續存——不是這個 hook 自己套值，
    // 因為它不知道呼叫端的 setter 有哪些。
    keepDraft: () => {
      baselineRef.current = RESTORED;
      setPendingDraft(null);
    },
    discardDraft: () => {
      clearEventDraft();
      setPendingDraft(null);
    },
  };
}
