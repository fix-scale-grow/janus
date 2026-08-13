"use client";

// Janus fork: landing-page telemetry stripped. Upstream initialised posthog-js
// in the browser and shipped CTA events to trycomp.ai's PostHog project. Both
// exports are kept (same signatures, still mounted on the landing page and
// called by the CTA buttons) but are now inert — no posthog-js import, no
// network calls, nothing leaves the visitor's browser.

export type CtaLocation = "hero" | "closing";

export function LandingAnalytics() {
	return null;
}

export function captureLanding(
	_event: "setup_prompt_copied" | "github_star_clicked",
	_location: CtaLocation,
): void {
	// no-op
}
