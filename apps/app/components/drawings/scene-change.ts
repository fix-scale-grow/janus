export type SceneChangeState = { seen: boolean; version: number | null };

export function initialSceneChangeState(): SceneChangeState {
	return { seen: false, version: null };
}

export function nextSceneChange(
	state: SceneChangeState,
	version: number | null,
): { state: SceneChangeState; save: boolean } {
	if (!state.seen) {
		return { state: { seen: true, version }, save: false };
	}
	if (version !== null && version === state.version) {
		return { state, save: false };
	}
	return { state: { seen: true, version }, save: true };
}
