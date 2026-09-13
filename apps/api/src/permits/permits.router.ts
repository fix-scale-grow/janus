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
	approvePermitAnswerInput,
	attachChecklistDocumentInput,
	clearPermitAnswerInput,
	createPermitInput,
	inspectionIdInput,
	lockerRenameInput,
	permitDealIdInput,
	permitIdInput,
	permitListInput,
	playbookFactPathInput,
	playbookIdInput,
	playbookInput,
	resolveJurisdictionInput,
	setInspectionInput,
	setPermitAnswerInput,
	setPermitStatusInput,
	setPlaybookDocumentsInput,
	setPlaybookFactInput,
	setPlaybookInspectionsInput,
	setWorksheetTemplateInput,
	updatePermitInput,
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

	@Query({ input: permitDealIdInput })
	async listByDeal(@Input() input: z.infer<typeof permitDealIdInput>) {
		return this.permits.listByDeal(input);
	}

	@Query({ input: permitListInput })
	async list(@Input() input: z.infer<typeof permitListInput>) {
		return this.permits.list(input);
	}

	@Query({ input: permitIdInput })
	async byId(@Input("permitId") permitId: string) {
		return this.permits.byId(permitId);
	}

	@Mutation({ input: createPermitInput })
	async create(
		@Input() input: z.infer<typeof createPermitInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.permits.create(input, ctx.user.id);
	}

	@Mutation({ input: setPermitStatusInput })
	async setStatus(@Input() input: z.infer<typeof setPermitStatusInput>) {
		return this.permits.setStatus(input);
	}

	@Mutation({ input: updatePermitInput })
	async update(@Input() input: z.infer<typeof updatePermitInput>) {
		return this.permits.update(input);
	}

	@Mutation({ input: setPermitAnswerInput })
	async setAnswer(
		@Input() input: z.infer<typeof setPermitAnswerInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.permits.setAnswer(input, ctx.user.id);
	}

	@Mutation({ input: permitIdInput })
	async applyPrefills(@Input("permitId") permitId: string) {
		return this.permits.applyPrefills({ permitId });
	}

	@Mutation({ input: approvePermitAnswerInput })
	async approveAnswer(
		@Input() input: z.infer<typeof approvePermitAnswerInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.permits.approveAnswer(input, ctx.user.id);
	}

	@Mutation({ input: permitIdInput })
	async approveAllReviewed(
		@Input("permitId") permitId: string,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.permits.approveAllReviewed({ permitId }, ctx.user.id);
	}

	@Mutation({ input: clearPermitAnswerInput })
	async clearAnswer(@Input() input: z.infer<typeof clearPermitAnswerInput>) {
		return this.permits.clearAnswer(input);
	}

	@Mutation({ input: attachChecklistDocumentInput })
	async attachChecklistDocument(
		@Input() input: z.infer<typeof attachChecklistDocumentInput>,
	) {
		return this.permits.attachChecklistDocument(input);
	}

	@Query()
	async lockerList() {
		return this.permits.lockerList();
	}

	@Mutation({ input: lockerRenameInput })
	async lockerRename(@Input() input: z.infer<typeof lockerRenameInput>) {
		return this.permits.lockerRename(input);
	}

	@Mutation({ input: setInspectionInput })
	async setInspection(@Input() input: z.infer<typeof setInspectionInput>) {
		return this.permits.setInspection(input);
	}

	@Mutation({ input: inspectionIdInput })
	async deleteInspection(@Input() input: z.infer<typeof inspectionIdInput>) {
		return this.permits.deleteInspection(input);
	}

	@Mutation({ input: permitDealIdInput })
	async dismissPrompt(
		@Input() input: z.infer<typeof permitDealIdInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.permits.dismissPrompt(input, ctx.user.id);
	}

	@Query({ input: permitDealIdInput })
	async promptState(@Input() input: z.infer<typeof permitDealIdInput>) {
		return this.permits.promptState(input);
	}
}
