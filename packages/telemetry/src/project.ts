// Janus fork: telemetry stripped. These constants previously pointed at
// trycomp.ai's own PostHog project (host + write key) — a competitor's
// analytics endpoint. Blanked so no upstream credentials live in Janus source
// and no client can be initialised against them. Kept as exports only for
// re-export compatibility via the package index.
export const POSTHOG_KEY = "";
export const POSTHOG_HOST = "";
export const POSTHOG_UI_HOST = "";
