export function log(msg: string, extra?: unknown): void {
  const ts = new Date().toISOString();
  if (extra === undefined) console.log(`[${ts}] ${msg}`);
  else console.log(`[${ts}] ${msg}`, extra);
}

export function section(name: string): void {
  console.log(`\n=== ${name} ===`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
