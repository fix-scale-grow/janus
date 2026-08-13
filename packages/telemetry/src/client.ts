import type { Properties } from "./allowlist";

// Janus fork: telemetry stripped. This module preserves the upstream export
// surface so every import site keeps compiling, but performs ZERO network I/O.
// No PostHog client is ever constructed and nothing is sent anywhere. The
// original posthog-node phone-home to k.trycomp.ai has been removed entirely.

type Debug = (message: string) => void;

let debug: Debug = () => {};

export function onTelemetryProblem(sink: Debug | null): void {
	debug = sink ?? (() => {});
}

export function resetTelemetryClient(): void {
	// No client exists; nothing to reset. Kept for call-site compatibility.
}

export function capture(_event: string, _properties: Properties = {}): void {
	// no-op
}

export async function captureNow(
	_event: string,
	_properties: Properties = {},
	_at?: Date,
	_uuid?: string,
): Promise<boolean> {
	return false;
}

export async function flushTelemetry(): Promise<void> {
	// no-op
}

export async function shutdownTelemetry(): Promise<void> {
	// no-op
}
