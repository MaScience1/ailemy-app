import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * ⚠ THE PLUGIN POINTS AT src/i18n/request.ts EXPLICITLY.
 * next-intl looks for ./i18n/request.ts relative to the project root by
 * default; this app keeps its source under src/, so without the argument the
 * config is silently not found and every message lookup falls back to the key.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
