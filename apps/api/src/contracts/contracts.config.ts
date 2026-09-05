export const CONTRACTS = {
	signingToken: {
		bytes: 32,
		expiryDays: 30,
		maxLength: 128,
	},
	signature: {
		drawnMaxChars: 500_000,
		drawnPrefix: "data:image/png;base64,",
		pngMagicBytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
	},
} as const;
