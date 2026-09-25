import { SlotStats } from "../types";

const canAttend = (s: SlotStats) => s.availableCount + s.ifNeededCount > 0;

// The slot the host's 拍板定案 starts on: the best-scoring slot anyone can
// attend. With no such slot (no votes, or only 不行) nothing is pre-selected,
// so the host has to pick one explicitly instead of finalizing slots[0]
// without noticing.
export function defaultFinalSlotId(stats: SlotStats[]): string | undefined {
  return [...stats].filter(canAttend).sort((a, b) => b.score - a.score)[0]?.slotId;
}

// Finalizing without votes is allowed (the backend lets the host decide
// early), but the confirm dialog should say so.
export function finalizeWarning(stats: SlotStats[], selectedSlotId: string): string | null {
  const selected = stats.find((s) => s.slotId === selectedSlotId);
  if (!stats.some((s) => s.availableCount + s.ifNeededCount + s.unavailableCount > 0)) return "目前還沒有人投票，確定要直接定案嗎？";
  if (selected && !canAttend(selected)) return "這個時段目前沒有人表示可以出席，確定要定案嗎？";
  return null;
}
