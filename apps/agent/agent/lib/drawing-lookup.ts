import { db, type Prisma } from "@crm/db";
import { fenceUntrusted } from "./untrusted";

export const DRAWING_LOOKUP = {
	limits: {
		defaultLimit: 20,
		maxLimit: 100,
	},
} as const;

export type DrawingAttachmentFilter = "any" | "none" | "deal" | "contact";

export type DrawingListOptions = {
	query?: string;
	attached?: DrawingAttachmentFilter;
	limit?: number;
};

export type DrawingListItem = {
	id: string;
	title: string;
	updatedAt: string;
	dealId: string | null;
	dealName: string | null;
	contactId: string | null;
	contactName: string | null;
	estimateCount: number;
};

export type DrawingListResult = {
	drawings: DrawingListItem[];
};

export async function listDrawings(
	options: DrawingListOptions = {},
): Promise<DrawingListResult> {
	const limit = Math.min(
		Math.max(options.limit ?? DRAWING_LOOKUP.limits.defaultLimit, 1),
		DRAWING_LOOKUP.limits.maxLimit,
	);
	const attached = options.attached ?? "any";

	const where: Prisma.DrawingWhereInput = {
		...(options.query?.trim()
			? { title: { contains: options.query.trim(), mode: "insensitive" } }
			: {}),
		...(attached === "none" ? { dealId: null, contactId: null } : {}),
		...(attached === "deal" ? { dealId: { not: null } } : {}),
		...(attached === "contact" ? { contactId: { not: null } } : {}),
	};

	const rows = await db.drawing.findMany({
		where,
		orderBy: { updatedAt: "desc" },
		take: limit,
		select: {
			id: true,
			title: true,
			updatedAt: true,
			dealId: true,
			deal: { select: { name: true } },
			contactId: true,
			contact: { select: { firstName: true, lastName: true } },
			_count: { select: { estimates: true } },
		},
	});

	return {
		drawings: rows.map((row) => {
			const contactName = row.contact
				? [row.contact.firstName, row.contact.lastName]
						.filter(Boolean)
						.join(" ")
				: null;

			return {
				id: row.id,
				title: fenceUntrusted("drawing title", row.title),
				updatedAt: row.updatedAt.toISOString(),
				dealId: row.dealId,
				dealName: row.deal ? fenceUntrusted("deal title", row.deal.name) : null,
				contactId: row.contactId,
				contactName: contactName
					? fenceUntrusted("contact name", contactName)
					: null,
				estimateCount: row._count.estimates,
			};
		}),
	};
}
