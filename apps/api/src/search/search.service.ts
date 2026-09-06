import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type SearchHit = {
	kind: "contact" | "deal";
	id: string;
	label: string;
	detail: string | null;
	iconUrl: string | null;
	iconDarkUrl: string | null;
	iconTone: string | null;
	imageUrl: string | null;
};

const PER_KIND = 5;

@Injectable()
export class SearchService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async quick(q: string): Promise<{ hits: SearchHit[] }> {
		const term = q.trim();
		if (term.length < 2) return { hits: [] };

		const [contacts, deals] = await Promise.all([
			this.db.contact.findMany({
				where: {
					OR: [
						{ firstName: { contains: term, mode: "insensitive" } },
						{ lastName: { contains: term, mode: "insensitive" } },
						{ email: { contains: term, mode: "insensitive" } },
					],
				},
				take: PER_KIND,
				orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					imageUrl: true,
					companyName: true,
				},
			}),
			this.db.deal.findMany({
				where: { name: { contains: term, mode: "insensitive" } },
				take: PER_KIND,
				orderBy: [{ stage: "asc" }, { name: "asc" }],
				select: { id: true, name: true },
			}),
		]);

		return {
			hits: [
				...contacts.map(
					(contact): SearchHit => ({
						kind: "contact",
						id: contact.id,
						label:
							[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
							(contact.email ?? "Unnamed"),
						detail: contact.companyName ?? contact.email,
						iconUrl: null,
						iconDarkUrl: null,
						iconTone: null,
						imageUrl: contact.imageUrl,
					}),
				),
				...deals.map(
					(deal): SearchHit => ({
						kind: "deal",
						id: deal.id,
						label: deal.name,
						detail: null,
						iconUrl: null,
						iconDarkUrl: null,
						iconTone: null,
						imageUrl: null,
					}),
				),
			],
		};
	}
}
