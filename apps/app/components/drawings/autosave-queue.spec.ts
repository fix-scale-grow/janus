import { describe, expect, it } from "bun:test";
import { createSaveQueue } from "./autosave-queue";

type Gate = { resolve: () => void; reject: (error: Error) => void };

function gatedRunner() {
	const gates: Gate[] = [];
	let active = 0;
	let maxActive = 0;
	let runs = 0;
	const run = () =>
		new Promise<void>((resolve, reject) => {
			runs += 1;
			active += 1;
			maxActive = Math.max(maxActive, active);
			gates.push({
				resolve: () => {
					active -= 1;
					resolve();
				},
				reject: (error) => {
					active -= 1;
					reject(error);
				},
			});
		});
	return {
		run,
		gates,
		stats: () => ({ runs, maxActive }),
	};
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createSaveQueue", () => {
	it("never overlaps two saves and coalesces changes made mid-flight", async () => {
		const runner = gatedRunner();
		const queue = createSaveQueue(runner.run);

		const first = queue.request();
		await tick();
		void queue.request();
		void queue.request();
		await tick();

		expect(runner.stats().runs).toBe(1);

		runner.gates[0]?.resolve();
		await tick();

		expect(runner.stats().runs).toBe(2);
		expect(runner.stats().maxActive).toBe(1);

		runner.gates[1]?.resolve();
		await first;
		expect(queue.idle()).toBe(true);
		expect(runner.stats().runs).toBe(2);
	});

	it("request resolves only after the coalesced follow-up persists", async () => {
		const runner = gatedRunner();
		const queue = createSaveQueue(runner.run);

		void queue.request();
		await tick();
		const second = queue.request();
		let done = false;
		void second.then(() => {
			done = true;
		});

		runner.gates[0]?.resolve();
		await tick();
		expect(done).toBe(false);

		runner.gates[1]?.resolve();
		await second;
		expect(done).toBe(true);
	});

	it("drain waits for the whole chain", async () => {
		const runner = gatedRunner();
		const queue = createSaveQueue(runner.run);

		void queue.request();
		await tick();
		void queue.request();
		const drained = queue.drain();
		let done = false;
		void drained.then(() => {
			done = true;
		});

		runner.gates[0]?.resolve();
		await tick();
		expect(done).toBe(false);
		runner.gates[1]?.resolve();
		await drained;
		expect(done).toBe(true);
		expect(queue.idle()).toBe(true);
	});

	it("a rejected save does not wedge the queue", async () => {
		const runner = gatedRunner();
		const queue = createSaveQueue(runner.run);

		const first = queue.request();
		await tick();
		void queue.request();
		runner.gates[0]?.reject(new Error("boom"));
		await tick();
		expect(runner.stats().runs).toBe(2);
		runner.gates[1]?.resolve();
		await first;
		expect(queue.idle()).toBe(true);

		void queue.request();
		await tick();
		expect(runner.stats().runs).toBe(3);
		runner.gates[2]?.resolve();
		await queue.drain();
		expect(queue.idle()).toBe(true);
	});
});
