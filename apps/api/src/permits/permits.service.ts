import { type Db, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { PERMITS } from "./permits.config";
import type { ResolveJurisdictionInput } from "./permits.contracts";

function normalizeSegment(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildJurisdictionMatchKey(
	state: string,
	kind: string,
	name: string,
): string {
	return [state, kind, name].map(normalizeSegment).join(":");
}

@Injectable()
export class PermitsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async resolveJurisdiction(input: ResolveJurisdictionInput) {
		const matchKey = buildJurisdictionMatchKey(
			input.state,
			input.kind,
			input.name,
		);

		const existing = await this.db.jurisdiction.findUnique({
			where: { matchKey },
		});
		if (existing) return existing;

		try {
			return await this.db.jurisdiction.create({
				data: {
					name: input.name,
					kind: input.kind,
					state: input.state,
					matchKey,
				},
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				return this.db.jurisdiction.findUniqueOrThrow({ where: { matchKey } });
			}
			throw error;
		}
	}

	async jurisdictions() {
		const rows = await this.db.jurisdiction.findMany({
			orderBy: { name: "asc" },
			take: PERMITS.list.pageSize,
			select: {
				id: true,
				name: true,
				kind: true,
				state: true,
				matchKey: true,
				createdAt: true,
				_count: { select: { playbooks: true } },
			},
		});

		return rows.map(({ _count, ...row }) => ({
			...row,
			playbookCount: _count.playbooks,
		}));
	}
}
