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
import { access } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type {
	AccessTrpcContext,
	AuthedTrpcContext,
} from "../trpc/context.types";
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
	verifyPlaybookDocumentInput,
	verifyPlaybookInspectionInput,
} from "./permits.contracts";
import { PermitsService } from "./permits.service";
import { PlaybooksService } from "./playbooks.service";

@Router({ alias: "permits" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class PermitsRouter {
	constructor(
		@Inject(PermitsService) private readonly permits: PermitsService,
		@Inject(PlaybooksService) private readonly playbooks: PlaybooksService,
	) {}

	@Mutation({
		input: resolveJurisdictionInput,
		meta: access("permits", "EDIT"),
	})
	async resolveJurisdiction(
		@Input() input: z.infer<typeof resolveJurisdictionInput>,
	) {
		return this.permits.resolveJurisdiction(input);
	}

	@Query({ meta: access("permits", "VIEW") })
	async jurisdictions() {
		return this.permits.jurisdictions();
	}

	@Query({ input: playbookInput, meta: access("permits", "VIEW") })
	async playbook(@Input() input: z.infer<typeof playbookInput>) {
		return this.playbooks.findOrCreate(input);
	}

	@Query({ input: playbookIdInput, meta: access("permits", "VIEW") })
	async playbookById(@Input("id") id: string) {
		return this.playbooks.byId(id);
	}

	@Mutation({ input: setPlaybookFactInput, meta: access("permits", "EDIT") })
	async setPlaybookFact(@Input() input: z.infer<typeof setPlaybookFactInput>) {
		return this.playbooks.setFact(input);
	}

	@Mutation({ input: playbookFactPathInput, meta: access("permits", "EDIT") })
	async verifyPlaybookFact(
		@Input() input: z.infer<typeof playbookFactPathInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.playbooks.verifyFact(input, ctx.user.id);
	}

	@Mutation({ input: playbookFactPathInput, meta: access("permits", "EDIT") })
	async clearPlaybookFact(
		@Input() input: z.infer<typeof playbookFactPathInput>,
	) {
		return this.playbooks.clearFact(input);
	}

	@Mutation({
		input: setPlaybookDocumentsInput,
		meta: access("permits", "EDIT"),
	})
	async setPlaybookDocuments(
		@Input() input: z.infer<typeof setPlaybookDocumentsInput>,
	) {
		return this.playbooks.setDocuments(input);
	}

	@Mutation({
		input: setPlaybookInspectionsInput,
		meta: access("permits", "EDIT"),
	})
	async setPlaybookInspections(
		@Input() input: z.infer<typeof setPlaybookInspectionsInput>,
	) {
		return this.playbooks.setInspections(input);
	}

	@Mutation({
		input: verifyPlaybookDocumentInput,
		meta: access("permits", "EDIT"),
	})
	async verifyPlaybookDocument(
		@Input() input: z.infer<typeof verifyPlaybookDocumentInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.playbooks.verifyDocument(input, ctx.user.id);
	}

	@Mutation({
		input: verifyPlaybookInspectionInput,
		meta: access("permits", "EDIT"),
	})
	async verifyPlaybookInspection(
		@Input() input: z.infer<typeof verifyPlaybookInspectionInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.playbooks.verifyInspection(input, ctx.user.id);
	}

	@Mutation({
		input: setWorksheetTemplateInput,
		meta: access("permits", "EDIT"),
	})
	async setWorksheetTemplate(
		@Input() input: z.infer<typeof setWorksheetTemplateInput>,
	) {
		return this.playbooks.setWorksheetTemplate(input);
	}

	@Query({ input: permitDealIdInput, meta: access("permits", "VIEW") })
	async listByDeal(
		@Input() input: z.infer<typeof permitDealIdInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.listByDeal(input, ctx.access);
	}

	@Query({ input: permitListInput, meta: access("permits", "VIEW") })
	async list(
		@Input() input: z.infer<typeof permitListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.list(input, ctx.access);
	}

	@Query({ input: permitIdInput, meta: access("permits", "VIEW") })
	async byId(
		@Input("permitId") permitId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.byId(permitId, ctx.access);
	}

	@Mutation({ input: createPermitInput, meta: access("permits", "EDIT") })
	async create(
		@Input() input: z.infer<typeof createPermitInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.create(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: setPermitStatusInput, meta: access("permits", "EDIT") })
	async setStatus(
		@Input() input: z.infer<typeof setPermitStatusInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.setStatus(input, ctx.access);
	}

	@Mutation({ input: updatePermitInput, meta: access("permits", "EDIT") })
	async update(
		@Input() input: z.infer<typeof updatePermitInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.update(input, ctx.access);
	}

	@Mutation({ input: setPermitAnswerInput, meta: access("permits", "EDIT") })
	async setAnswer(
		@Input() input: z.infer<typeof setPermitAnswerInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.setAnswer(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: permitIdInput, meta: access("permits", "EDIT") })
	async applyPrefills(
		@Input("permitId") permitId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.applyPrefills({ permitId }, ctx.access);
	}

	@Mutation({
		input: approvePermitAnswerInput,
		meta: access("permits", "EDIT"),
	})
	async approveAnswer(
		@Input() input: z.infer<typeof approvePermitAnswerInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.approveAnswer(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: permitIdInput, meta: access("permits", "EDIT") })
	async approveAllReviewed(
		@Input("permitId") permitId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.approveAllReviewed(
			{ permitId },
			ctx.user.id,
			ctx.access,
		);
	}

	@Mutation({ input: clearPermitAnswerInput, meta: access("permits", "EDIT") })
	async clearAnswer(
		@Input() input: z.infer<typeof clearPermitAnswerInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.clearAnswer(input, ctx.access);
	}

	@Mutation({
		input: attachChecklistDocumentInput,
		meta: access("permits", "EDIT"),
	})
	async attachChecklistDocument(
		@Input() input: z.infer<typeof attachChecklistDocumentInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.attachChecklistDocument(input, ctx.access);
	}

	@Query({ meta: access("permits", "VIEW") })
	async lockerList() {
		return this.permits.lockerList();
	}

	@Mutation({ input: lockerRenameInput, meta: access("permits", "EDIT") })
	async lockerRename(@Input() input: z.infer<typeof lockerRenameInput>) {
		return this.permits.lockerRename(input);
	}

	@Mutation({ input: setInspectionInput, meta: access("permits", "EDIT") })
	async setInspection(
		@Input() input: z.infer<typeof setInspectionInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.setInspection(input, ctx.access);
	}

	@Mutation({ input: inspectionIdInput, meta: access("permits", "DELETE") })
	async deleteInspection(
		@Input() input: z.infer<typeof inspectionIdInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.deleteInspection(input, ctx.access);
	}

	@Mutation({ input: permitDealIdInput, meta: access("permits", "EDIT") })
	async dismissPrompt(
		@Input() input: z.infer<typeof permitDealIdInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.dismissPrompt(input, ctx.user.id, ctx.access);
	}

	@Query({ input: permitDealIdInput, meta: access("permits", "VIEW") })
	async promptState(
		@Input() input: z.infer<typeof permitDealIdInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.promptState(input, ctx.access);
	}

	@Mutation({ input: permitIdInput, meta: access("permits", "EDIT") })
	async worksheetPdf(
		@Input("permitId") permitId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.permits.worksheetPdf({ permitId }, ctx.access);
	}
}
