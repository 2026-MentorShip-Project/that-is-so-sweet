import React from "react";
import { Sparkles, Star, MapPin, ExternalLink, RefreshCw, PartyPopper, Share2, Copy, Clock, Phone, TrainFront, Info } from "lucide-react";
import { Button, Tag } from "../../../design-system/components";
import { cardStyle } from "../mobileStyles";
import { RecommendationResult } from "../../../types";
import { canShare, shareText } from "../../../share/share";
import { describeResolvedPreferences, formatPrice, mapsSearchUrl } from "../../../share/ai/recommendationView";

interface RecommendResultsStepProps {
  result: RecommendationResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectDisabled: boolean;
  onRefresh: () => void;
  refreshDisabled: boolean;
  eventBroadcast: string;
  onCopySuccess: () => void;
  onRestart: () => void;
  onClose: () => void;
}

const reasonBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-primary-subtle)",
  color: "var(--color-primary)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const metaStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-muted)" };

export const RecommendResultsStep: React.FC<RecommendResultsStepProps> = ({
  result,
  selectedId,
  onSelect,
  selectDisabled,
  onRefresh,
  refreshDisabled,
  eventBroadcast,
  onCopySuccess,
  onRestart,
  onClose,
}) => {
  const { restaurants } = result;
  const chosen = restaurants.find((r) => r.id === selectedId) || null;
  const chosenPrice = chosen ? formatPrice(chosen) : null;
  const chosenBroadcast = chosen
    ? `${eventBroadcast}\n\n🍽️ 推薦餐廳：${chosen.name}${chosen.rating !== null ? `（⭐${chosen.rating.toFixed(1)}${chosenPrice ? ` · ${chosenPrice}` : ""}）` : chosenPrice ? `（${chosenPrice}）` : ""}\n📍 ${chosen.address}\n🔗 ${mapsSearchUrl(chosen.name, chosen.address)}`
    : "";

  const handleCopy = async () => {
    if (!chosen) return;
    try {
      await navigator.clipboard.writeText(chosenBroadcast);
      onCopySuccess();
    } catch {
      window.prompt("複製通知：", chosenBroadcast);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...cardStyle, background: "var(--color-primary-subtle)", borderColor: "transparent", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Sparkles size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--color-primary)" }} />
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--color-ink)" }}>
          <div style={{ fontWeight: 800 }}>AI 依這些條件搜尋：</div>
          {describeResolvedPreferences(result.resolvedPreferences)}
        </div>
      </div>

      {result.notes && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, lineHeight: 1.6, color: "var(--color-muted)" }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>{result.notes}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
          {chosen ? "已選定，其餘推薦僅供對照：" : `以下 ${restaurants.length} 間為 AI 推薦餐廳，主揪可直接選一間拍板：`}
        </div>
        {!chosen && (
          <button
            onClick={onRefresh}
            disabled={refreshDisabled}
            title="重新推薦會再用掉一次額度"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              border: "none",
              background: "none",
              color: refreshDisabled ? "var(--color-muted)" : "var(--color-primary)",
              fontSize: 11,
              fontWeight: 700,
              cursor: refreshDisabled ? "not-allowed" : "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <RefreshCw size={12} />
            重新推薦
          </button>
        )}
      </div>

      {restaurants.map((r) => {
        const isSelected = r.id === selectedId;
        const isDimmed = chosen !== null && !isSelected;
        const price = formatPrice(r);
        return (
          <div key={r.id} style={{ ...cardStyle, opacity: isDimmed ? 0.4 : 1, filter: isDimmed ? "grayscale(1)" : "none", transition: "opacity 200ms ease, filter 200ms ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>{r.name}</div>
              {isSelected && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: "rgba(90,158,90,0.15)", color: "var(--color-success)", fontSize: 10, fontWeight: 800 }}>
                  <PartyPopper size={10} />
                  已選定
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
              {r.cuisineType && <Tag size="sm">{r.cuisineType}</Tag>}
              {r.rating !== null && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: "var(--color-ink)" }}>
                  <Star size={12} fill="var(--color-secondary)" color="var(--color-secondary)" />
                  {r.rating.toFixed(1)}
                  {r.reviewCount !== null && <span style={{ fontWeight: 500, color: "var(--color-muted)" }}>（{r.reviewCount.toLocaleString()} 則）</span>}
                </span>
              )}
              {price && <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-ink)" }}>{price}</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {r.distanceInfo?.transitPoint && (
                <span style={metaStyle}>
                  <TrainFront size={12} />
                  {r.distanceInfo.transitPoint}
                  {r.distanceInfo.walkMinutes !== null ? ` 步行約 ${r.distanceInfo.walkMinutes} 分鐘` : ""}
                </span>
              )}
              <span style={{ ...metaStyle, alignItems: "flex-start" }}>
                <MapPin size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                {r.address}
              </span>
              {r.openingHours && (
                <span style={metaStyle}>
                  <Clock size={12} />
                  {r.openingHours}
                </span>
              )}
              {r.phone && (
                <span style={metaStyle}>
                  <Phone size={12} />
                  {r.phone}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <a
                href={mapsSearchUrl(r.name, r.address)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}
              >
                <ExternalLink size={11} />
                在 Google Maps 開啟
              </a>
              {r.sourceUrl && (
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="提到這家店的文章，不一定是店家官方頁面"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--color-muted)", textDecoration: "none" }}
                >
                  <ExternalLink size={11} />
                  參考來源
                </a>
              )}
            </div>

            {r.recommendReason && (
              <div style={reasonBoxStyle}>
                <Sparkles size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{r.recommendReason}</span>
              </div>
            )}

            {!chosen && (
              <div style={{ marginTop: 10 }}>
                <Button variant="dark" fullWidth disabled={selectDisabled} onClick={() => onSelect(r.id)}>
                  選這家，就決定是這裡
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {chosen && (
        <div style={{ ...cardStyle, background: "rgba(90,158,90,0.06)", borderColor: "rgba(90,158,90,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>一鍵複製確認通知</div>
            <button
              onClick={handleCopy}
              title="複製確認通知"
              aria-label="複製確認通知"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-ink)", borderRadius: "var(--radius-sm)" }}
            >
              <Copy size={16} />
            </button>
          </div>
          <div style={{ background: "#fff", borderRadius: "var(--radius-md)", padding: 10, fontSize: 11, whiteSpace: "pre-line", overflowWrap: "anywhere", lineHeight: 1.6, color: "var(--color-ink)", marginBottom: canShare ? 8 : 0 }}>
            {chosenBroadcast}
          </div>
          {canShare && (
            <Button variant="secondary" fullWidth icon={<Share2 size={16} />} onClick={() => shareText({ title: "推薦餐廳確認通知", text: chosenBroadcast })}>
              分享
            </Button>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="muted" fullWidth onClick={onRestart}>
              重新選一次
            </Button>
            <Button variant="primary" fullWidth onClick={onClose}>
              完成，關閉
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
