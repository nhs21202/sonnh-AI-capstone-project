import type { BarInput } from "../types";
import { storeLocalToUTC } from "./time";

export const hexRe = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Length caps — mirror the backend (validate.Bar): title fits its DB column, message the 1–200 limit.
export const MAX_TITLE = 120;
export const MAX_MESSAGE = 200;

export type FieldKey =
  | "title"
  | "message"
  | "background_color"
  | "text_color"
  | "countdown_bg_color"
  | "countdown_text_color"
  | "deadline";
export type Errors = Partial<Record<FieldKey, string>>;

// computeErrors mirrors the backend's validate.Bar so bad input is blocked before the request.
// `tz`/`now` are injectable for tests; the editor passes its store timezone and the wall clock.
export function computeErrors(
  input: BarInput,
  deadlineLocal: string,
  tz = "UTC",
  now: number = Date.now(),
): Errors {
  const e: Errors = {};
  const title = input.title.trim();
  if (!title) e.title = "Title is required.";
  else if ([...title].length > MAX_TITLE) e.title = `Title must be ${MAX_TITLE} characters or fewer.`;
  if (!input.message.trim()) e.message = "Message is required.";
  else if ([...input.message].length > MAX_MESSAGE)
    e.message = `Message must be ${MAX_MESSAGE} characters or fewer.`;
  const colors: [FieldKey, string][] = [
    ["background_color", input.background_color],
    ["text_color", input.text_color],
    ["countdown_bg_color", input.countdown_bg_color],
    ["countdown_text_color", input.countdown_text_color],
  ];
  for (const [k, v] of colors) if (!hexRe.test(v)) e[k] = "Enter a valid hex color, e.g. #1A1A1A.";
  if (input.countdown_enabled) {
    if (!deadlineLocal) e.deadline = "Deadline is required when the countdown is on.";
    else if (new Date(storeLocalToUTC(deadlineLocal, tz)).getTime() <= now)
      e.deadline = "Deadline must be in the future.";
  }
  return e;
}
