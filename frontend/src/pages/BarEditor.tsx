import { useEffect, useMemo, useRef, useState } from "react";
import {
  Page,
  Card,
  Layout,
  FormLayout,
  TextField,
  Checkbox,
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

const TZ = "UTC";
const hexRe = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAVE_BAR_ID = "bar-editor-save-bar";

type FieldKey = "title" | "message" | "background_color" | "text_color" | "countdown_bg_color" | "countdown_text_color" | "deadline";
type Errors = Partial<Record<FieldKey, string>>;

// Minimal shape of the App Bridge save-bar API (provided by window.shopify in the embedded admin).
type AppBridge = {
  saveBar: { show: (id: string) => void; hide: (id: string) => void; leaveConfirmation: () => Promise<void> };
};

// Color field: a swatch that opens a Polaris ColorPicker popover + a hex TextField (inline error).
function HexField({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
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

function computeErrors(input: BarInput, deadlineLocal: string): Errors {
  const e: Errors = {};
  if (!input.title.trim()) e.title = "Title is required.";
  if (input.enabled && !input.message.trim()) e.message = "Message is required when the bar is enabled.";
  const colors: [FieldKey, string][] = [
    ["background_color", input.background_color],
    ["text_color", input.text_color],
    ["countdown_bg_color", input.countdown_bg_color],
    ["countdown_text_color", input.countdown_text_color],
  ];
  for (const [k, v] of colors) if (!hexRe.test(v)) e[k] = "Enter a valid hex color, e.g. #1A1A1A.";
  if (input.countdown_enabled) {
    if (!deadlineLocal) e.deadline = "Deadline is required when the countdown is on.";
    else if (new Date(storeLocalToUTC(deadlineLocal, TZ)).getTime() <= Date.now()) e.deadline = "Deadline must be in the future.";
  }
  return e;
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
    <div style={{ background: "repeating-conic-gradient(#eef0f2 0% 25%, #f6f7f8 0% 50%) 50% / 22px 22px", padding: 22, borderRadius: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
          padding: "11px 18px",
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

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || deadlineLocal !== initialDeadline.current;

  // Contextual save bar follows the dirty state; hide on unmount.
  useEffect(() => {
    if (dirty) shopify.saveBar.show(SAVE_BAR_ID);
    else shopify.saveBar.hide(SAVE_BAR_ID);
  }, [dirty, shopify]);
  useEffect(() => () => shopify.saveBar.hide(SAVE_BAR_ID), [shopify]);

  function set<K extends keyof BarInput>(key: K, value: BarInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }) as Errors);
  }
  function setDeadline(v: string) {
    setDeadlineLocal(v);
    setErrors((e) => ({ ...e, deadline: undefined }));
  }

  async function save() {
    const e = computeErrors(form, deadlineLocal);
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
      if (bar) await barsRepo.update(bar.id, payload);
      else await barsRepo.create(payload);
      shopify.saveBar.hide(SAVE_BAR_ID);
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

  // Block leaving with unsaved changes (App Bridge shows the leave-confirmation modal).
  async function handleBack() {
    if (!dirty) {
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
    <Page fullWidth title={bar ? "Edit bar" : "Add bar"} backAction={{ content: "Announcement bars", onAction: handleBack }}>
      <SaveBar id={SAVE_BAR_ID}>
        {/* App Bridge styles these; `variant` is a custom attribute. */}
        <button {...({ variant: "primary" } as Record<string, unknown>)} onClick={save} disabled={saving}>
          Save
        </button>
        <button onClick={discard}>Discard</button>
      </SaveBar>

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
                  <TextField label="Title" value={form.title} onChange={(v) => set("title", v)} autoComplete="off" error={errors.title} helpText="Internal label only — shown in your admin list, never on the storefront." />
                  <Checkbox label="Enabled (active on storefront)" checked={form.enabled} onChange={(v) => set("enabled", v)} helpText="Enabling this deactivates the others — at most one bar can be active per shop." />
                  <TextField label="Message" value={form.message} onChange={(v) => set("message", v)} multiline autoComplete="off" error={errors.message} helpText="1–200 characters. The text shown on the bar." />
                  <HexField label="Background color" value={form.background_color} onChange={(v) => set("background_color", v)} error={errors.background_color} hint="Hex, e.g. #1A1A1A." />
                  <HexField label="Text color" value={form.text_color} onChange={(v) => set("text_color", v)} error={errors.text_color} hint="Hex, e.g. #FFFFFF." />
                </FormLayout>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Countdown timer
                </Text>
                <Checkbox label="Enable countdown" checked={form.countdown_enabled} onChange={(v) => set("countdown_enabled", v)} />
                {form.countdown_enabled && (
                  <FormLayout>
                    <TextField label="Countdown deadline" type="datetime-local" value={deadlineLocal} onChange={setDeadline} autoComplete="off" error={errors.deadline} helpText="Interpreted in your store timezone, then stored as UTC. Must be in the future." />
                    <HexField label="Countdown background" value={form.countdown_bg_color} onChange={(v) => set("countdown_bg_color", v)} error={errors.countdown_bg_color} />
                    <HexField label="Countdown text color" value={form.countdown_text_color} onChange={(v) => set("countdown_text_color", v)} error={errors.countdown_text_color} />
                    <Select label="Countdown format" options={formats} value={form.countdown_format} onChange={(v) => set("countdown_format", v as CountdownFormat)} />
                  </FormLayout>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Live preview — wide column on the right */}
        <Layout.Section>
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
        </Layout.Section>
      </Layout>
    </Page>
  );
}
