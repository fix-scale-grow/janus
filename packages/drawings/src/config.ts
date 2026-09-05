export const SQFT_PER_SQUARE = 100;

export const PITCH_FACTORS = {
	flat: 1.0,
	"3/12": 1.031,
	"4/12": 1.054,
	"5/12": 1.083,
	"6/12": 1.118,
	"7/12": 1.158,
	"8/12": 1.202,
	"9/12": 1.25,
	"10/12": 1.302,
	"12/12": 1.414,
} as const;

export type PitchKey = keyof typeof PITCH_FACTORS;

export const DRAWINGS = {
	autosave: { debounceMs: 2_000, versionEveryMs: 5 * 60_000 },
	thumbnail: { width: 640 },
	unattachedNudgeDays: 3,
} as const;
