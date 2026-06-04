export function maskBenefitSecret(value: string | null | undefined, fallback = "等待配置"): string {
  if (!value) {
    return fallback;
  }

  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}
