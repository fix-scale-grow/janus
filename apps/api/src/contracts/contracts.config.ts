export const CONTRACTS = {
	signingToken: {
		bytes: 32,
		expiryDays: 30,
	},
	signature: {
		drawnMaxChars: 500_000,
		drawnPrefix: "data:image/png;base64,",
	},
} as const;
