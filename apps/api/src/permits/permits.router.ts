import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	playbookFactPathInput,
	playbookIdInput,
	playbookInput,
	resolveJurisdictionInput,
	setPlaybookDocumentsInput,
	setPlaybookFactInput,
	setPlaybookInspectionsInput,
	setWorksheetTemplateInput,
} from "./permits.contracts";
import { PermitsService } from "./permits.service";
import { PlaybooksService } from "./playbooks.service";

@Router({ alias: "permits" })
@UseMiddlewares(AuthMiddleware)
export class PermitsRouter {
	constructor(
		@Inject(PermitsService) private readonly permits: PermitsService,
		@Inject(PlaybooksService) private readonly playbooks: PlaybooksService,
	) {}

	@Mutation({ input: resolveJurisdictionInput })
	async resolveJurisdiction(
		@Input() input: z.infer<typeof resolveJurisdictionInput>,
	) {
		return this.permits.resolveJurisdiction(input);
	}

	@Query()
	async jurisdictions() {
		return this.permits.jurisdictions();
	}

	@Query({ input: playbookInput })
	async playbook(@Input() input: z.infer<typeof playbookInput>) {
		return this.playbooks.findOrCreate(input);
	}

	@Query({ input: playbookIdInput })
	async playbookById(@Input("id") id: string) {
		return this.playbooks.byId(id);
	}

	@Mutation({ input: setPlaybookFactInput })
	async setPlaybookFact(@Input() input: z.infer<typeof setPlaybookFactInput>) {
		return this.playbooks.setFact(input);
	}

	@Mutation({ input: playbookFactPathInput })
	async verifyPlaybookFact(
		@Input() input: z.infer<typeof playbookFactPathInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.playbooks.verifyFact(input, ctx.user.id);
	}

	@Mutation({ input: playbookFactPathInput })
	async clearPlaybookFact(
		@Input() input: z.infer<typeof playbookFactPathInput>,
	) {
		return this.playbooks.clearFact(input);
	}

	@Mutation({ input: setPlaybookDocumentsInput })
	async setPlaybookDocuments(
		@Input() input: z.infer<typeof setPlaybookDocumentsInput>,
	) {
		return this.playbooks.setDocuments(input);
	}

	@Mutation({ input: setPlaybookInspectionsInput })
	async setPlaybookInspections(
		@Input() input: z.infer<typeof setPlaybookInspectionsInput>,
	) {
		return this.playbooks.setInspections(input);
	}

	@Mutation({ input: setWorksheetTemplateInput })
	async setWorksheetTemplate(
		@Input() input: z.infer<typeof setWorksheetTemplateInput>,
	) {
		return this.playbooks.setWorksheetTemplate(input);
	}
}
