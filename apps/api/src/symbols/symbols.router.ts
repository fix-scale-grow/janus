import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { access, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import type { SymbolPackKey } from "./symbol-packs";
import {
	symbolBulkSetServiceInput,
	symbolBulkSetTradeInput,
	symbolCreateInput,
	symbolIdInput,
	symbolIdsInput,
	symbolListInput,
	symbolPackInput,
	symbolUpdateInput,
} from "./symbols.contracts";
import { SymbolsService } from "./symbols.service";

@Router({ alias: "symbols" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class SymbolsRouter {
	constructor(
		@Inject(SymbolsService)
		private readonly symbols: SymbolsService,
	) {}

	@Query({ input: symbolListInput, meta: anyMember() })
	async list(@Input() input: z.infer<typeof symbolListInput>) {
		return this.symbols.list(input);
	}

	@Query({ input: symbolIdInput, meta: anyMember() })
	async byId(@Input("id") id: string) {
		return this.symbols.byId(id);
	}

	@Mutation({ input: symbolCreateInput, meta: access("drawings", "EDIT") })
	async create(@Input() input: z.infer<typeof symbolCreateInput>) {
		return this.symbols.create(input);
	}

	@Mutation({ input: symbolUpdateInput, meta: access("drawings", "EDIT") })
	async update(@Input() input: z.infer<typeof symbolUpdateInput>) {
		return this.symbols.update(input);
	}

	@Mutation({ input: symbolIdInput, meta: access("drawings", "EDIT") })
	async delete(@Input("id") id: string) {
		return this.symbols.delete(id);
	}

	@Mutation({ input: symbolIdsInput, meta: access("drawings", "EDIT") })
	async bulkDelete(@Input("ids") ids: string[]) {
		return this.symbols.bulkDelete(ids);
	}

	@Mutation({
		input: symbolBulkSetTradeInput,
		meta: access("drawings", "EDIT"),
	})
	async bulkSetTrade(@Input() input: z.infer<typeof symbolBulkSetTradeInput>) {
		return this.symbols.bulkSetTrade(input.ids, input.trade);
	}

	@Mutation({
		input: symbolBulkSetServiceInput,
		meta: access("drawings", "EDIT"),
	})
	async bulkSetService(
		@Input() input: z.infer<typeof symbolBulkSetServiceInput>,
	) {
		return this.symbols.bulkSetService(input.ids, input.serviceId);
	}

	@Query({ meta: anyMember() })
	async usage() {
		return this.symbols.usage();
	}

	@Mutation({ input: symbolIdInput, meta: access("drawings", "EDIT") })
	async duplicate(@Input("id") id: string) {
		return this.symbols.duplicate(id);
	}

	@Mutation({ input: symbolPackInput, meta: access("drawings", "EDIT") })
	async seedPack(@Input("pack") pack: z.infer<typeof symbolPackInput>["pack"]) {
		return this.symbols.seedPack(pack as SymbolPackKey);
	}
}
