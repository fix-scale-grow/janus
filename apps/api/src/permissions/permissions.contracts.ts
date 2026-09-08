import { z } from "zod";
import { ALL_PERMISSION_KEYS } from "./permissions.config";

export const permissionKeyEnum = z.enum(
	ALL_PERMISSION_KEYS as [string, ...string[]],
);

export const permissionGrantInput = z.object({
	userId: z.string().min(1),
	key: permissionKeyEnum,
});
export type PermissionGrantInput = z.infer<typeof permissionGrantInput>;
