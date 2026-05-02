export const SERVICE_CATEGORIES = [
  "plumbing",
  "landscaping",
  "electrical",
  "hvac",
  "painting",
  "pest_control",
  "general_handyman",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const DISPLAY_LABELS: Record<ServiceCategory, string> = {
  plumbing: "Plumbing",
  landscaping: "Landscaping",
  electrical: "Electrical",
  hvac: "HVAC",
  painting: "Painting",
  pest_control: "Pest Control",
  general_handyman: "General Handyman",
};

export function getCategoryLabel(category: ServiceCategory): string {
  return DISPLAY_LABELS[category];
}

export function isValidCategory(value: string): value is ServiceCategory {
  return SERVICE_CATEGORIES.includes(value as ServiceCategory);
}
