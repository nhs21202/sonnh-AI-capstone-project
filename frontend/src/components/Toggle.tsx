// A small accessible on/off switch (Polaris has no Switch component). Green when on, grey when off,
// with a sliding knob. Renders as a <button role="switch"> so Space/Enter toggle it for free.
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string; // accessible name (visually-hidden); show a visible label beside it if needed
  disabled?: boolean;
}) {
  const W = 48;
  const H = 26;
  const KNOB = 20;
  const PAD = 3;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: W,
        height: H,
        flex: "0 0 auto",
        borderRadius: H,
        border: "none",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#1a1a1a" : "#8a8a8a",
        opacity: disabled ? 0.6 : 1,
        transition: "background 120ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: PAD,
          left: checked ? W - KNOB - PAD : PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,.25)",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}
