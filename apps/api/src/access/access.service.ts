import type { Db } from "@crm/db";
import type { AccessArea } from "@crm/db/access-config";
import {
	type AccessNeed,
	type AccessPrincipal,
	allows,
	refusalMessage,
} from "@crm/db/access-policy";
import { ensureAccessGroups, resolvePrincipal } from "@crm/db/access-resolve";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class AccessService {
	private seeded: Promise<void> | null = null;

	constructor(@InjectDatabase() private readonly db: Db) {}

	async principal(userId: string): Promise<AccessPrincipal> {
		this.seeded ??= ensureAccessGroups(this.db).catch((error) => {
			this.seeded = null;
			throw error;
		});
		await this.seeded;
		const p = await resolvePrincipal(this.db, userId);
		if (!p)
			throw new ForbiddenException("You are not a member of this workspace.");
		return p;
	}

	assert(
		p: AccessPrincipal,
		area: AccessArea,
		need: AccessNeed | readonly AccessNeed[],
	): void {
		if (allows(p, area, need)) return;
		const first = typeof need === "string" ? need : need[0];
		throw new ForbiddenException(refusalMessage(p, area, first as AccessNeed));
	}

	assertAdmin(p: AccessPrincipal): void {
		if (!p.isAdmin)
			throw new ForbiddenException("Only an owner or an admin can do this.");
	}

	notFound(label: string): never {
		throw new NotFoundException(`No ${label} with that id.`);
	}
}
