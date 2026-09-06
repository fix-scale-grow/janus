const MAX_TRACKED_SESSIONS = 500;

const modelBySession = new Map<string, string>();

export function noteModel(sessionId: string, modelId: string): void {
	modelBySession.delete(sessionId);
	modelBySession.set(sessionId, modelId);

	while (modelBySession.size > MAX_TRACKED_SESSIONS) {
		const oldest = modelBySession.keys().next().value;
		if (oldest === undefined) break;
		modelBySession.delete(oldest);
	}
}

export function modelFor(sessionId: string): string | null {
	return modelBySession.get(sessionId) ?? null;
}
