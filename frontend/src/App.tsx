import { useState } from "react";
import { BarsList } from "./pages/BarsList";
import { BarEditor } from "./pages/BarEditor";
import type { Bar } from "./types";

type View = { name: "list" } | { name: "editor"; bar: Bar | null };

// Admin shell: toggles between the bars list and the per-bar editor.
export function App() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "editor") {
    return <BarEditor bar={view.bar} onDone={() => setView({ name: "list" })} />;
  }
  return (
    <BarsList
      onAdd={() => setView({ name: "editor", bar: null })}
      onEdit={(bar) => setView({ name: "editor", bar })}
    />
  );
}
