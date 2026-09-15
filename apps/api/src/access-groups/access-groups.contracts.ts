import { ACCESS_SCOPES, ACCESS_SURFACES } from "@crm/db/access-config";
import { accessPolicySchema } from "@crm/db/access-policy";
import { z } from "zod";

export const accessGroupInput = z.object({
	name: z.string().trim().min(1).max(60),
	surface: z.enum(ACCESS_SURFACES),
	scope: z.enum(ACCESS_SCOPES),
	policy: accessPolicySchema,
});
export type AccessGroupInput = z.infer<typeof accessGroupInput>;

export const accessGroupUpdateInput = accessGroupInput.extend({
	id: z.string().min(1),
});
export type AccessGroupUpdateInput = z.infer<typeof accessGroupUpdateInput>;

export const accessGroupIdInput = z.object({ id: z.string().min(1) });
export type AccessGroupIdInput = z.infer<typeof accessGroupIdInput>;

export const memberAccessInput = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("admin") }),
	z.object({ kind: z.literal("group"), groupId: z.string().min(1) }),
]);
export type MemberAccessInput = z.infer<typeof memberAccessInput>;

export const setMemberAccessInput = z.object({
	memberId: z.string().min(1),
	access: memberAccessInput,
});
export type SetMemberAccessInput = z.infer<typeof setMemberAccessInput>;
