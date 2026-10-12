export function toSafeCssBackground(imageUrl: string | null): string | undefined {
  if (!imageUrl) return undefined;

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return `url(${JSON.stringify(parsed.href)})`;
  } catch {
    return undefined;
  }
}
