import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	symbolCreateInput,
	symbolIdInput,
	symbolListInput,
	symbolUpdateInput,
} from "./symbols.contracts";
import { SymbolsService } from "./symbols.service";

@Router({ alias: "symbols" })
@UseMiddlewares(AuthMiddleware)
export class SymbolsRouter {
	constructor(
		@Inject(SymbolsService)
		private readonly symbols: SymbolsService,
	) {}

	@Query({ input: symbolListInput })
	async list(@Input() input: z.infer<typeof symbolListInput>) {
		return this.symbols.list(input);
	}

	@Query({ input: symbolIdInput })
	async byId(@Input("id") id: string) {
		return this.symbols.byId(id);
	}

	@Mutation({ input: symbolCreateInput })
	async create(@Input() input: z.infer<typeof symbolCreateInput>) {
		return this.symbols.create(input);
	}

	@Mutation({ input: symbolUpdateInput })
	async update(@Input() input: z.infer<typeof symbolUpdateInput>) {
		return this.symbols.update(input);
	}

	@Mutation({ input: symbolIdInput })
	async delete(@Input("id") id: string) {
		return this.symbols.delete(id);
	}

	@Mutation()
	async seedRoofing() {
		return this.symbols.seedRoofing();
	}
}
