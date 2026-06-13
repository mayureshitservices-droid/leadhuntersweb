export function env(key: string, fallback?: string): string | undefined {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.replace(/^"(.*)"$/, '$1').trim();
}
