import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router } from "nestjs-trpc";
import type { z } from "zod";
import {
	contractSignInput,
	contractSigningTokenInput,
} from "./contracts.contracts";
import { ContractsService } from "./contracts.service";

@Router({ alias: "contractSigning" })
export class ContractSigningRouter {
	constructor(
		@Inject(ContractsService) private readonly contracts: ContractsService,
	) {}

	@Query({ input: contractSigningTokenInput })
	async bySigningToken(@Input("token") token: string) {
		return this.contracts.bySigningToken(token);
	}

	@Mutation({ input: contractSignInput })
	async sign(@Input() input: z.infer<typeof contractSignInput>) {
		return this.contracts.sign(input);
	}
}
