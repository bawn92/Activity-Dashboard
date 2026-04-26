import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { logger } from "../logger";

let bundlePromise: Promise<string> | null = null;

/**
 * Bundle the Remotion composition once and cache the resulting serve URL.
 * The first call kicks off webpack via @remotion/bundler — it can take 15-30s.
 * Subsequent calls return the cached URL immediately.
 */
export function getRemotionServeUrl(): Promise<string> {
  if (bundlePromise) {
    return bundlePromise;
  }

  bundlePromise = (async () => {
    // Find the workspace root by walking up from this source file looking
    // for `lib/remotion-compositions/src/remotion-entry.tsx`. Works in both
    // dev (tsx, src layout) and prod (esbuild bundle in dist/).
    const here = path.dirname(fileURLToPath(import.meta.url));
    const fs = await import("node:fs/promises");
    const ENTRY_REL = "lib/remotion-compositions/src/remotion-entry.tsx";

    const tried: string[] = [];
    let entryPoint: string | null = null;
    let dir = here;
    for (let i = 0; i < 8; i++) {
      const candidate = path.join(dir, ENTRY_REL);
      tried.push(candidate);
      try {
        await fs.access(candidate);
        entryPoint = candidate;
        break;
      } catch {
        // not here — climb one level
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    if (!entryPoint) {
      // Final fallback: assume cwd is the workspace root (typical pnpm dev)
      const cwdCandidate = path.resolve(process.cwd(), ENTRY_REL);
      tried.push(cwdCandidate);
      try {
        await fs.access(cwdCandidate);
        entryPoint = cwdCandidate;
      } catch {
        throw new Error(
          `Could not locate ${ENTRY_REL}. Tried: ${tried.join(", ")}`,
        );
      }
    }

    logger.info({ entryPoint }, "Bundling Remotion composition (one-time)");
    const start = Date.now();
    const serveUrl = await bundle({
      entryPoint,
      // Defaults are fine — webpack runs in-process.
    });
    logger.info(
      { ms: Date.now() - start, serveUrl },
      "Remotion bundle ready",
    );
    return serveUrl;
  })();

  // If bundling fails, clear the cache so the next render attempt retries.
  bundlePromise.catch(() => {
    bundlePromise = null;
  });

  return bundlePromise;
}
