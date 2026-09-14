export const PROPOSALS = {
	viewToken: {
		bytes: 32,
		expiryDays: 30,
		maxLength: 128,
	},
	cover: {
		titleMax: 200,
		subtitleMax: 300,
	},
	acceptName: {
		max: 200,
	},
} as const;
