import { z } from "zod";

export const RECENT_KINDS = [
	"contact",
	"deal",
	"drawing",
	"estimate",
	"invoice",
	"contract",
	"project",
] as const;

export type RecentKind = (typeof RECENT_KINDS)[number];

export const recentTouchInput = z.object({
	kind: z.enum(RECENT_KINDS),
	recordId: z.string().min(1),
});

export type RecentTouchInput = z.infer<typeof recentTouchInput>;
