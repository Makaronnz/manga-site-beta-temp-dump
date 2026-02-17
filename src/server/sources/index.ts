// /src/server/sources/index.ts
import type { SourceAdapter } from "./base";
import { MALAdapter } from "./mal";
import { MUAdapter } from "./mangaupdates";
import { BatoAdapter } from "./bato";

const adapters: Record<string, SourceAdapter> = {
  [MALAdapter.key]: MALAdapter,
  [MUAdapter.key]: MUAdapter,
  [BatoAdapter.key]: BatoAdapter
};

export function getAdapter(key: string): SourceAdapter {
  const a = adapters[key];
  if (!a) throw new Error(`Unknown adapter: ${key}`);
  return a;
}
