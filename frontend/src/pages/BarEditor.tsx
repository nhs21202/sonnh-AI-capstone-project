import { useEffect, useMemo, useRef, useState } from "react";
import {
  Page,
  Card,
  Layout,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Popover,
  ColorPicker,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { barsRepo } from "../api/AnnouncementBarRepository";
import { defaultBarInput, type Bar, type BarInput, type CountdownFormat } from "../types";
import { storeLocalToUTC, utcToStoreLocal } from "../lib/time";
import { formatRemaining } from "../lib/countdown";
import { hexToHsba, hsbaToHex } from "../lib/color";
import { computeErrors, hexRe, MAX_TITLE, MAX_MESSAGE, type Errors } from "../lib/barValidation";
import { Toggle } from "../components/Toggle";

// The merchant's deadline is wall-clock time in their own timezone, so convert via the browser's
// timezone (not a hardcoded "UTC", which skewed the stored UTC by the local offset, e.g. +7 in ICT).
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const SAVE_BAR_ID = "bar-editor-save-bar";

// Minimal shape of the App Bridge save-bar API (provided by window.shopify in the embedded admin).
type AppBridge = {
  saveBar: { show: (id: string) => void; hide: (id: string) => void; leaveConfirmation: () => Promise<void> };
  toast: { show: (message: string, options?: { duration?: number; isError?: boolean }) => void };
};

// Color field: a swatch that opens a Polaris ColorPicker popover + a hex TextField (inline error).
function HexField({ label, value, onChange, error, hint, required }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const valid = hexRe.test(value);
  const swatch = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label={`${label} color picker`}
      style={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: 8, border: "1px solid #c9cccf", background: valid ? value : "#ffffff", cursor: "pointer", padding: 0 }}
    />
  );
  return (
    <BlockStack gap="100">
      <Text as="span" variant="bodySm">
        {label}
        {required ? <Text as="span" tone="critical"> *</Text> : null}
      </Text>
      <InlineStack gap="200" blockAlign="center">
        <Popover active={open} activator={swatch} onClose={() => setOpen(false)} preferredAlignment="left">
          <div style={{ padding: 12 }}>
            <ColorPicker color={hexToHsba(valid ? value : "#000000")} allowAlpha onChange={(c) => onChange(hsbaToHex(c))} />
          </div>
        </Popover>
        <div style={{ maxWidth: 180, flex: 1 }}>
          <TextField label={label} labelHidden value={value} onChange={onChange} autoComplete="off" error={error} />
        </div>
      </InlineStack>
      {hint && !error && (
        <Text as="span" variant="bodySm" tone="subdued">
          {hint}
        </Text>
      )}
    </BlockStack>
  );
}

// Live preview — re-renders as fields change; ticks the countdown every second.
function LivePreview({ form, deadlineLocal }: { form: BarInput; deadlineLocal: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!form.countdown_enabled) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [form.countdown_enabled]);

  let countdown = "--:--:--:--";
  if (form.countdown_enabled && deadlineLocal) {
    const deadline = new Date(storeLocalToUTC(deadlineLocal, TZ)).getTime();
    countdown = formatRemaining(Math.max(0, deadline - Date.now()), form.countdown_format);
  }

  return (
    <div style={{ background: "repeating-conic-gradient(#eef0f2 0% 25%, #f6f7f8 0% 50%) 50% / 22px 22px", borderRadius: 10, minHeight: 440, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
          padding: "11px 18px",
          minHeight: 48,
          boxSizing: "border-box",
          width: "100%",
          fontWeight: 600,
          textAlign: "center",
          background: hexRe.test(form.background_color) ? form.background_color : "#1A1A1A",
          color: hexRe.test(form.text_color) ? form.text_color : "#FFFFFF",
        }}
      >
        <span>{form.message || "Your message"}</span>
        {form.countdown_enabled && (
          <span
            style={{
              padding: "4px 11px",
              borderRadius: 999,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              background: hexRe.test(form.countdown_bg_color) ? form.countdown_bg_color : "#000000",
              color: hexRe.test(form.countdown_text_color) ? form.countdown_text_color : "#FFFFFF",
            }}
          >
            {countdown}
          </span>
        )}
      </div>
    </div>
  );
}

export function BarEditor({ bar, onDone }: { bar: Bar | null; onDone: () => void }) {
  const shopify = useAppBridge() as unknown as AppBridge;
  const initial = useMemo<BarInput>(() => (bar ? { ...bar } : defaultBarInput()), [bar]);
  const [form, setForm] = useState<BarInput>(initial);
  const [deadlineLocal, setDeadlineLocal] = useState<string>(bar?.countdown_end_at ? utcToStoreLocal(bar.countdown_end_at, TZ) : "");
  const initialDeadline = useRef(deadlineLocal);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const isEdit = bar !== null;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || deadlineLocal !== initialDeadline.current;

  // Edit mode uses the App Bridge contextual save bar (dirty-driven). Add mode uses a page primary
  // action ("Create bar") instead, so neither save-bar effect runs while creating a new bar.
  useEffect(() => {
    if (!isEdit) return;
    if (dirty) shopify.saveBar.show(SAVE_BAR_ID);
    else shopify.saveBar.hide(SAVE_BAR_ID);
  }, [dirty, shopify, isEdit]);
  useEffect(() => {
    if (!isEdit) return;
    return () => shopify.saveBar.hide(SAVE_BAR_ID);
  }, [shopify, isEdit]);

  function set<K extends keyof BarInput>(key: K, value: BarInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }) as Errors);
  }
  function setDeadline(v: string) {
    setDeadlineLocal(v);
    setErrors((e) => ({ ...e, deadline: undefined }));
  }

  async function save() {
    const e = computeErrors(form, deadlineLocal, TZ);
    if (Object.values(e).some(Boolean)) {
      setErrors(e);
      return;
    }
    const payload: BarInput = {
      ...form,
      countdown_end_at: form.countdown_enabled && deadlineLocal ? storeLocalToUTC(deadlineLocal, TZ) : null,
    };
    setSaving(true);
    try {
      if (bar) {
        await barsRepo.update(bar.id, payload);
        shopify.toast.show("Bar saved");
      } else {
        await barsRepo.create(payload);
        shopify.toast.show("Bar created");
      }
      if (isEdit) shopify.saveBar.hide(SAVE_BAR_ID);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setForm(initial);
    setDeadlineLocal(initialDeadline.current);
    setErrors({});
  }

  // In edit mode, block leaving with unsaved changes (App Bridge leave-confirmation modal).
  // In add mode there is no save bar, so back just returns to the list.
  async function handleBack() {
    if (!isEdit || !dirty) {
      onDone();
      return;
    }
    try {
      await shopify.saveBar.leaveConfirmation();
      onDone();
    } catch {
      /* user chose to stay */
    }
  }

  const formats: { label: string; value: CountdownFormat }[] = [
    { label: "dd:hh:mm:ss", value: "dd:hh:mm:ss" },
    { label: "hh:mm:ss", value: "hh:mm:ss" },
    { label: "with labels", value: "with_labels" },
  ];

  return (
    <Page
      fullWidth
      title={bar ? "Edit bar" : "Add bar"}
      backAction={{ content: "Announcement bars", onAction: handleBack }}
      primaryAction={isEdit ? undefined : { content: "Create bar", onAction: save, loading: saving }}
    >
      {isEdit && (
        <SaveBar id={SAVE_BAR_ID}>
          {/* App Bridge styles these; `variant` is a custom attribute. */}
          <button {...({ variant: "primary" } as Record<string, unknown>)} onClick={save} disabled={saving}>
            Save
          </button>
          <button onClick={discard}>Discard</button>
        </SaveBar>
      )}

      <Layout>
        {/* Settings — narrow (oneThird) column on the left */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="300">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Bar settings
                </Text>
                <FormLayout>
                  <TextField label="Title" requiredIndicator value={form.title} onChange={(v) => set("title", v)} autoComplete="off" error={errors.title} maxLength={MAX_TITLE} />
                  <TextField label="Message" requiredIndicator value={form.message} onChange={(v) => set("message", v)} multiline autoComplete="off" error={errors.message} maxLength={MAX_MESSAGE} />
                  <InlineStack gap="300" blockAlign="center">
                    <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Enabled (active on storefront)" />
                    <Text as="span" fontWeight="semibold">
                      Enabled (active on storefront)
                    </Text>
                  </InlineStack>
                  <HexField label="Background color" value={form.background_color} onChange={(v) => set("background_color", v)} error={errors.background_color} required />
                  <HexField label="Text color" value={form.text_color} onChange={(v) => set("text_color", v)} error={errors.text_color} required />
                </FormLayout>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Countdown timer
                </Text>
                <InlineStack gap="300" blockAlign="center">
                  <Toggle checked={form.countdown_enabled} onChange={(v) => set("countdown_enabled", v)} label="Enable countdown" />
                  <Text as="span" fontWeight="semibold">
                    Enable countdown
                  </Text>
                </InlineStack>
                {form.countdown_enabled && (
                  <FormLayout>
                    <TextField label="Countdown deadline" requiredIndicator type="datetime-local" value={deadlineLocal} onChange={setDeadline} autoComplete="off" error={errors.deadline} />
                    <HexField label="Countdown background" value={form.countdown_bg_color} onChange={(v) => set("countdown_bg_color", v)} error={errors.countdown_bg_color} required />
                    <HexField label="Countdown text color" value={form.countdown_text_color} onChange={(v) => set("countdown_text_color", v)} error={errors.countdown_text_color} required />
                    <Select label="Countdown format" options={formats} value={form.countdown_format} onChange={(v) => set("countdown_format", v as CountdownFormat)} />
                  </FormLayout>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Live preview — wide column on the right; sticky so it stays in view while scrolling. */}
        <Layout.Section>
          <div style={{ position: "sticky", top: 16 }}>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingSm">
                  Live preview
                </Text>
                <Badge>Updates as you edit</Badge>
              </InlineStack>
              <LivePreview form={form} deadlineLocal={deadlineLocal} />
              <Text as="span" tone="subdued" variant="bodySm">
                This is exactly how the active bar renders at the top of your storefront.
              </Text>
            </BlockStack>
          </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
