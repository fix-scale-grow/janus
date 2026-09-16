import { describe, expect, it } from "bun:test";

const SCRIPT = `
import { fromDay, fromUtcDay, toDay, toUtcDay } from "@crm/ui/lib/format";

const stored = new Date("2026-09-15T00:00:00.000Z");

console.log(
	JSON.stringify({
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		shown: toUtcDay(stored),
		shownLocal: toDay(stored),
		written: fromUtcDay("2026-09-15")?.toISOString(),
		writtenLocal: fromDay("2026-09-15")?.toISOString(),
	}),
);
`;

type Reading = {
	zone: string;
	shown: string;
	shownLocal: string;
	written: string;
	writtenLocal: string;
};

function readIn(zone: string): Reading {
	const run = Bun.spawnSync(["bun", "-e", SCRIPT], {
		env: { ...process.env, TZ: zone },
		stdout: "pipe",
		stderr: "pipe",
	});

	if (!run.success) throw new Error(run.stderr.toString());

	return JSON.parse(run.stdout.toString()) as Reading;
}

describe("a stored day in a timezone that is not UTC", () => {
	it("shows the day the server stored, west of UTC", () => {
		const reading = readIn("America/Chicago");

		expect(reading.zone).toBe("America/Chicago");
		expect(reading.shown).toBe("2026-09-15");
		expect(reading.shownLocal).toBe("2026-09-14");
	});

	it("writes the day the user picked, east of UTC", () => {
		const reading = readIn("Asia/Tokyo");

		expect(reading.zone).toBe("Asia/Tokyo");
		expect(reading.written).toBe("2026-09-15T00:00:00.000Z");
		expect(reading.writtenLocal).toBe("2026-09-14T15:00:00.000Z");
	});

	it("round-trips a stored day in both timezones", () => {
		for (const zone of ["America/Chicago", "Asia/Tokyo"]) {
			const reading = readIn(zone);
			expect(reading.shown).toBe("2026-09-15");
			expect(reading.written).toBe("2026-09-15T00:00:00.000Z");
		}
	});
});
