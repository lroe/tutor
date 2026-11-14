export const DEFAULT_MODEL = "gemini-3.8-flash";

export interface ModelOption {
  id: string;
  name: string;
  note: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    note: "Balanced. Recommended.",
  },
  {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    note: "Smarter, a little slower.",
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    note: "Frontier reasoning.",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    note: "Previous generation.",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    note: "Fastest and cheapest.",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash (preview)",
    note: "Preview model.",
  },
];

export function modelName(id: string): string {
  return MODEL_OPTIONS.find((option) => option.id === id)?.name ?? id;
}
