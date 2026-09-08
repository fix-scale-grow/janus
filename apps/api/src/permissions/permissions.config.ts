export const PERMISSION_KEYS = {
	profitView: "profit.view",
} as const;

export type PermissionKey =
	(typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export const ALL_PERMISSION_KEYS = Object.values(
	PERMISSION_KEYS,
) as PermissionKey[];
