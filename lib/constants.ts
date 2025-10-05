export const STANDUP_CATEGORIES = [
  { value: "observational", label: "Observational Comedy" },
  { value: "storytelling", label: "Storytelling Sets" },
  { value: "improv", label: "Improv Moments" },
  { value: "one-liners", label: "One-Liners" },
  { value: "crowd-work", label: "Crowd Work" },
  { value: "satire", label: "Satire & Commentary" },
  { value: "musical", label: "Musical Comedy" },
  { value: "character", label: "Character Bits" },
  { value: "clean", label: "Clean Comedy" },
  { value: "nsfw", label: "Late Night" }
] as const

export const DEFAULT_CATEGORY_VALUE = STANDUP_CATEGORIES[0]?.value ?? "observational"
