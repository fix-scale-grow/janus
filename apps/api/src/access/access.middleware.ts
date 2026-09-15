import { Inject, Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type {
	MiddlewareOptions,
	MiddlewareResponse,
	TRPCMiddleware,
} from "nestjs-trpc";
import type {
	AccessTrpcContext,
	AuthedTrpcContext,
} from "../trpc/context.types";
import type { AccessMeta } from "./access.meta";
import { AccessService } from "./access.service";

@Injectable()
export class AccessMiddleware implements TRPCMiddleware {
	constructor(@Inject(AccessService) private readonly access: AccessService) {}

	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as AuthedTrpcContext;
		const tag = (opts.meta as AccessMeta | undefined)?.access;
		if (!tag) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Procedure ${opts.path} has no access tag.`,
			});
		}
		const principal = await this.access.principal(ctx.user.id);
		if (principal.surface === "FIELD" && !tag.field) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Field mode can't use this.",
			});
		}
		if (tag.kind === "admin") this.access.assertAdmin(principal);
		if (tag.kind === "area") this.access.assert(principal, tag.area, tag.need);
		const nextCtx: AccessTrpcContext = { ...ctx, access: principal };
		return opts.next({ ctx: nextCtx });
	}
}
