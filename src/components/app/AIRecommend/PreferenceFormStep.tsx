import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Tag, Button, Input } from "../../../design-system/components";
import { cardStyle, SectionLabel } from "../mobileStyles";
import { PreferenceForm } from "../../../api/recommendationsApi";
import {
  RELATIONSHIP_OPTIONS,
  BUDGET_OPTIONS,
  PARTY_SIZE_OPTIONS,
  SITUATIONAL_OPTIONS,
  SPICE_OPTIONS,
  CUISINE_OPTIONS,
  PREFERENCE_LIMITS,
} from "../../../mocks/aiRecommendDemo";

interface PreferenceFormStepProps {
  form: PreferenceForm;
  onChange: (patch: Partial<PreferenceForm>) => void;
  onSkip: () => void;
  onNext: () => void;
  disabled: boolean;
}

// Free-text chips (custom cuisines, dietary restrictions): type, press Enter
// or 加入, remove with ×. Capped at the backend's item count and length.
const ChipInput: React.FC<{
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max: number;
  maxLength: number;
  disabled: boolean;
}> = ({ values, onChange, placeholder, max, maxLength, disabled }) => {
  const [draft, setDraft] = useState("");
  const full = values.length >= max;
  const add = () => {
    const v = draft.trim();
    if (!v || full || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {values.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {values.map((v) => (
            <span
              key={v}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 6px 3px 10px", borderRadius: "var(--radius-pill)", background: "var(--color-primary-subtle)", color: "var(--color-primary)", fontSize: 12, fontWeight: 700 }}
            >
              {v}
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                disabled={disabled}
                aria-label={`移除 ${v}`}
                style={{ border: "none", background: "none", padding: 0, display: "flex", color: "inherit", cursor: "pointer" }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1 }}>
          <Input
            size="sm"
            placeholder={full ? `最多 ${max} 項` : placeholder}
            value={draft}
            maxLength={maxLength}
            disabled={disabled || full}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button variant="secondary" size="sm" icon={<Plus size={14} />} disabled={disabled || full || !draft.trim()} onClick={add}>
          加入
        </Button>
      </div>
    </div>
  );
};

export const PreferenceFormStep: React.FC<PreferenceFormStepProps> = ({ form, onChange, onSkip, onNext, disabled }) => {
  const toggle = <T extends string>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const customCuisines = form.cuisines.filter((c) => !(CUISINE_OPTIONS as readonly string[]).includes(c));
  const cuisinesFull = form.cuisines.length >= PREFERENCE_LIMITS.cuisines;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={cardStyle}>
        <SectionLabel title="地點（選填）" hint="沒填就用活動的地點" />
        <Input
          size="sm"
          placeholder="例如：中山站、北車附近"
          value={form.location}
          maxLength={PREFERENCE_LIMITS.location}
          disabled={disabled}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </div>

      <div style={cardStyle}>
        <SectionLabel title="與會關係（選填）" hint="影響 AI 推薦的氛圍與桌型配置" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {RELATIONSHIP_OPTIONS.map((r) => (
            <Tag key={r} variant="orange" active={form.relationship === r} onClick={() => !disabled && onChange({ relationship: form.relationship === r ? null : r })}>
              {r}
            </Tag>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionLabel title="預算區間（選填）" hint="每人平均消費" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {BUDGET_OPTIONS.map((b) => (
            <Tag key={b} variant="yellow" active={form.budget === b} onClick={() => !disabled && onChange({ budget: form.budget === b ? null : b })}>
              {b}
            </Tag>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionLabel title="人數規格（選填）" hint="已依回覆「可以」的人數預選" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PARTY_SIZE_OPTIONS.map((p) => (
            <Tag key={p} variant="default" active={form.partySize === p} onClick={() => !disabled && onChange({ partySize: form.partySize === p ? null : p })}>
              {p}
            </Tag>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionLabel title="飲食偏好（選填）" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <Tag variant="orange" active={form.vegetarian} onClick={() => !disabled && onChange({ vegetarian: !form.vegetarian })}>
            素食
          </Tag>
          {SPICE_OPTIONS.map((s) => (
            <Tag key={s} variant="orange" active={form.spice === s} onClick={() => !disabled && onChange({ spice: form.spice === s ? null : s })}>
              {s}
            </Tag>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6 }}>
          料理類型 <span style={{ fontWeight: 500, color: "var(--color-muted)" }}>可複選，最多 {PREFERENCE_LIMITS.cuisines} 項</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {CUISINE_OPTIONS.map((c) => {
            const active = form.cuisines.includes(c);
            return (
              <Tag key={c} variant="yellow" active={active} onClick={() => !disabled && (active || !cuisinesFull) && onChange({ cuisines: toggle(form.cuisines, c) })}>
                {c}
              </Tag>
            );
          })}
        </div>
        <ChipInput
          values={customCuisines}
          onChange={(next) => onChange({ cuisines: [...form.cuisines.filter((c) => !customCuisines.includes(c)), ...next] })}
          placeholder="其他料理，例如：越南菜"
          max={PREFERENCE_LIMITS.cuisines - (form.cuisines.length - customCuisines.length)}
          maxLength={PREFERENCE_LIMITS.cuisineLength}
          disabled={disabled}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 6px" }}>
          忌口／過敏 <span style={{ fontWeight: 500, color: "var(--color-muted)" }}>最多 {PREFERENCE_LIMITS.restrictions} 項</span>
        </div>
        <ChipInput
          values={form.restrictions}
          onChange={(next) => onChange({ restrictions: next })}
          placeholder="例如：花生過敏、不吃牛"
          max={PREFERENCE_LIMITS.restrictions}
          maxLength={PREFERENCE_LIMITS.restrictionLength}
          disabled={disabled}
        />
      </div>

      <div style={cardStyle}>
        <SectionLabel title="硬體與情境（選填）" hint="可複選" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SITUATIONAL_OPTIONS.map((s) => (
            <Tag key={s} variant="default" active={form.situational.includes(s)} onClick={() => !disabled && onChange({ situational: toggle(form.situational, s) })}>
              {s}
            </Tag>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionLabel title="其他需求（選填）" hint={`自由輸入，最多 ${PREFERENCE_LIMITS.customPrompt} 字`} />
        <textarea
          value={form.customPrompt}
          onChange={(e) => onChange({ customPrompt: e.target.value })}
          placeholder="例如：想找有包廂、可以慶生的餐廳"
          maxLength={PREFERENCE_LIMITS.customPrompt}
          disabled={disabled}
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            padding: 10,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--color-ink)",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Button variant="muted" fullWidth disabled={disabled} onClick={onSkip}>
          略過，使用預設推薦
        </Button>
        <Button variant="primary" fullWidth disabled={disabled} onClick={onNext}>
          產生 AI 推薦
        </Button>
      </div>
    </div>
  );
};
