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
	"12/12": Math.SQRT2,
} as const;

export type PitchKey = keyof typeof PITCH_FACTORS;

export const DRAWINGS = {
	autosave: { debounceMs: 2_000, versionEveryMs: 5 * 60_000 },
	thumbnail: { width: 640, minIntervalMs: 60_000, maxBytes: 2 * 1024 * 1024 },
	unattachedNudgeDays: 3,
	scopePanel: { recomputeMs: 500 },
	pin: { sizePx: 24 },
	library: {
		storageKey: "janus.drawings.library",
		seededFlagKey: "janus.drawings.librarySeeded",
		seedUrl: "/libraries/janus-roofing.excalidrawlib",
		allowedHostSuffixes: ["excalidraw.com"],
	},
	limits: { maxSceneBytes: 8_000_000, maxVersions: 50 },
	backgroundImage: { maxDimensionPx: 2_400, jpegQuality: 0.85 },
	satellite: {
		fallbackCenter: [-98.5795, 39.8283] as [number, number],
		fallbackZoom: 4,
		addressZoom: 19,
		moveThrottleMs: 1_000,
		mapStyleBaseUrl: "https://api.maptiler.com/maps/hybrid/style.json",
		geocodeBaseUrl: "https://api.maptiler.com/geocoding",
		sqftPerSqm: 10.7639,
		metersPerFoot: 3.28084,
	},
} as const;
