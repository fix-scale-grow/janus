const SECOND_MS = 1000;

export const CONVERSATIONS = {
	builder: { pendingTimeoutMs: 60 * SECOND_MS },
} as const;

export const AGENT_UNREACHABLE = "Janus is unavailable right now. Try again.";

export const AGENT_UNREACHABLE_CODE = "agent_unreachable";
