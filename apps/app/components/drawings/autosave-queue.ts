export type SaveQueue = {
	request: () => Promise<void>;
	drain: () => Promise<void>;
	idle: () => boolean;
};

export function createSaveQueue(run: () => Promise<unknown>): SaveQueue {
	let current: Promise<void> | null = null;
	let dirty = false;

	const start = (): Promise<void> => {
		const cycle = run()
			.catch(() => undefined)
			.then(() => {
				if (dirty) {
					dirty = false;
					current = start();
					return current;
				}
				current = null;
			});
		return cycle;
	};

	const drain = async (): Promise<void> => {
		while (current) await current;
	};

	const request = (): Promise<void> => {
		if (current) {
			dirty = true;
		} else {
			current = start();
		}
		return drain();
	};

	return {
		request,
		drain,
		idle: () => current === null && !dirty,
	};
}
