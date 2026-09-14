import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router } from "nestjs-trpc";
import type { z } from "zod";
import {
	proposalAcceptInput,
	proposalDeclineInput,
	proposalTokenInput,
} from "./proposals.contracts";
import { ProposalsService } from "./proposals.service";

@Router({ alias: "proposalView" })
export class ProposalViewRouter {
	constructor(
		@Inject(ProposalsService) private readonly proposals: ProposalsService,
	) {}

	@Query({ input: proposalTokenInput })
	async byToken(@Input("token") token: string) {
		return this.proposals.byToken(token);
	}

	@Mutation({ input: proposalAcceptInput })
	async accept(@Input() input: z.infer<typeof proposalAcceptInput>) {
		return this.proposals.accept(input);
	}

	@Mutation({ input: proposalDeclineInput })
	async decline(@Input() input: z.infer<typeof proposalDeclineInput>) {
		return this.proposals.decline(input);
	}
}
