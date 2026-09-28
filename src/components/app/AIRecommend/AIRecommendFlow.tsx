import React, { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, Info, Loader2, AlertTriangle } from "lucide-react";
import { EventData, AiSelectedRestaurant, AiQuota, RecommendationRequest, RecommendationResult } from "../../../types";
import { useViewport } from "../../../share/useViewport";
import { buildFinalizedBroadcast } from "../../../share/shareText";
import { PreferenceForm, RecommendationError, getAiQuota, requestRestaurantRecommendations, toRecommendationRequest } from "../../../api/recommendationsApi";
import { emptyPreferenceForm, partySizeForCount, demoQuota, demoRecommendation } from "../../../mocks/aiRecommendDemo";
import { aiErrorMessage, toSelectedRestaurant } from "../../../share/ai/recommendationView";
import { PreferenceFormStep } from "./PreferenceFormStep";
import { RecommendResultsStep } from "./RecommendResultsStep";

type Step = "preference" | "results";

interface AIRecommendFlowProps {
  event: EventData;
  onClose: () => void;
  onCopySuccess: () => void;
  onSelectAiRestaurant: (restaurant: AiSelectedRestaurant) => void;
}

export const AIRecommendFlow: React.FC<AIRecommendFlowProps> = ({ event, onClose, onCopySuccess, onSelectAiRestaurant }) => {
  const { isMobile } = useViewport();
  const isDemo = event.id.startsWith("demo-");

  // Same count the backend uses for attendeeCount: 「可以」 on the finalized slot.
  const attendeeCount = useMemo(
    () => (event.finalSlotId ? event.responses.filter((r) => r.availability[event.finalSlotId!] === "available").length : 0),
    [event]
  );
  const buildInitialForm = (): PreferenceForm => ({
    ...emptyPreferenceForm,
    partySize: attendeeCount > 0 ? partySizeForCount(attendeeCount) : null,
  });

  const [step, setStep] = useState<Step>("preference");
  const [form, setForm] = useState<PreferenceForm>(buildInitialForm);
  const [lastRequest, setLastRequest] = useState<RecommendationRequest>({});
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(() => (isDemo ? demoQuota() : null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    getAiQuota()
      .then(setQuota)
      .catch(() => setQuota(null)); // the recommendation request reports its own errors
  }, [isDemo]);

  const eventBroadcast = useMemo(() => buildFinalizedBroadcast(event), [event]);
  const chosen = result?.restaurants.find((r) => r.id === selectedId) || null;

  // Leaving the flow with a restaurant selected is what confirms it.
  const handleClose = () => {
    if (chosen) onSelectAiRestaurant(toSelectedRestaurant(chosen, new Date().toISOString()));
    onClose();
  };

  const generate = async (request: RecommendationRequest, shuffle = false) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setLastRequest(request);
    try {
      const res = isDemo
        ? demoRecommendation(event, Object.keys(request).length > 0 ? form : emptyPreferenceForm, attendeeCount, shuffle)
        : await requestRestaurantRecommendations(event.id, request);
      setResult(res);
      setQuota(res.quota);
      setSelectedId(null);
      setStep("results");
    } catch (err) {
      const notes = err instanceof RecommendationError && err.notes ? `\nAI 說明：${err.notes}` : "";
      setError(aiErrorMessage(err) + notes);
      if (!isDemo) getAiQuota().then(setQuota).catch(() => {});
    } finally {
      setIsGenerating(false);
    }
  };

  const goRestart = () => {
    setStep("preference");
    setForm(buildInitialForm());
    setResult(null);
    setSelectedId(null);
    setError(null);
  };

  const quotaBlocked = quota !== null && (!quota.serviceAvailable || !quota.available);
  const blockedMessage = quota && !quota.serviceAvailable ? "AI 推薦服務目前未開放，請稍後再試。" : `本月 AI 推薦次數已用完（${quota?.limit ?? 20} 次），下個月 1 日會重置。`;

  const overlayStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, background: "var(--color-cream)", zIndex: 300, display: "flex", flexDirection: "column" }
    : { position: "fixed", inset: 0, background: "rgba(26,18,8,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };

  const cardOuterStyle: React.CSSProperties = isMobile
    ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }
    : { background: "var(--color-cream)", borderRadius: "var(--radius-modal)", width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" };

  return (
    <div style={overlayStyle}>
      <div style={cardOuterStyle}>
        {/* Header */}
        <div style={{ position: "relative", padding: "14px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0, borderRadius: isMobile ? 0 : "var(--radius-modal) var(--radius-modal) 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {step === "results" && (
                <button onClick={() => setStep("preference")} disabled={isGenerating} aria-label="返回條件" style={{ border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", display: "flex", flexShrink: 0 }}>
                  <ChevronLeft size={18} />
                </button>
              )}
              <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                <span style={{ fontSize: 14, fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--color-ink)", flexShrink: 0 }}>AI 推薦餐廳</span>
                {quota && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    本月已用 {quota.used}/{quota.limit} 次
                  </span>
                )}
                {step === "preference" && (
                  <button onClick={() => setShowInfo((v) => !v)} aria-label="說明" style={{ border: "none", background: "none", padding: 0, display: "flex", alignItems: "center", color: "var(--color-muted)", cursor: "pointer", flexShrink: 0 }}>
                    <Info size={13} />
                  </button>
                )}
              </div>
            </div>
            <button onClick={handleClose} aria-label="關閉" style={{ border: "none", background: "none", color: "var(--color-muted)", cursor: "pointer", display: "flex", flexShrink: 0 }}>
              <X size={20} />
            </button>
          </div>

          {showInfo && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 310 }} onClick={() => setShowInfo(false)} />
              <div
                style={{ position: "absolute", top: "100%", left: 16, right: 16, marginTop: 6, background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", padding: 10, fontSize: 11, lineHeight: 1.6, color: "var(--color-ink)", zIndex: 320 }}
              >
                每個條件都是選填。沒填的部分會用活動的地點、定案時段與回覆「可以」的人數補上。只有成功產生推薦才會計入本月次數，重新推薦也算一次。
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {error && (
            <div role="alert" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-hot-subtle)", color: "var(--color-hot)", fontSize: 12, fontWeight: 700, lineHeight: 1.6, whiteSpace: "pre-line" }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {isGenerating && (
            <div role="status" style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--color-primary-subtle)", color: "var(--color-primary)", fontSize: 12, fontWeight: 700 }}>
              <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />
              AI 正在搜尋附近的餐廳，通常需要 20–40 秒…
            </div>
          )}

          {step === "preference" &&
            (quotaBlocked ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--color-muted)", fontSize: 13, lineHeight: 1.7 }}>{blockedMessage}</div>
            ) : (
              <PreferenceFormStep
                form={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                onSkip={() => generate({})}
                onNext={() => generate(toRecommendationRequest(form))}
                disabled={isGenerating}
              />
            ))}

          {step === "results" && result && (
            <RecommendResultsStep
              result={result}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRefresh={() => generate(lastRequest, true)}
              refreshDisabled={isGenerating || quotaBlocked}
              eventBroadcast={eventBroadcast}
              onCopySuccess={onCopySuccess}
              onRestart={goRestart}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
