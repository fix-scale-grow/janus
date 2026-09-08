import type { IncomingMessage } from "node:http";
import { FORMS } from "@crm/db/forms";
import {
	Controller,
	Get,
	HttpCode,
	Options,
	Param,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { isFormId } from "./forms.config";
import { formSubmitInput } from "./forms.contracts";
import { FormsService } from "./forms.service";

@Controller("api/f")
export class FormsPublicController {
	constructor(private readonly forms: FormsService) {}

	@Get("config/:formId")
	@AllowAnonymous()
	async config(
		@Param("formId") formId: string,
		@Res({ passthrough: true }) response: Response,
	) {
		response.setHeader("cross-origin-resource-policy", "cross-origin");
		response.setHeader("access-control-allow-origin", "*");

		if (!isFormId(formId)) return { config: null };

		const config = await this.forms.publicConfig(formId);

		return { config };
	}

	@Options("s")
	@AllowAnonymous()
	@HttpCode(204)
	preflight(@Res({ passthrough: true }) response: Response): void {
		respondCors(response);
	}

	@Post("s")
	@AllowAnonymous()
	async submit(
		@Req() request: IncomingMessage,
		@Res({ passthrough: true }) response: Response,
	) {
		respondCors(response);

		const raw = await read(request, FORMS.submit.maxBodyBytes);
		if (!raw)
			return { ok: false, errors: { _form: "The submission was too large." } };

		let body: unknown;
		try {
			body = JSON.parse(raw);
		} catch {
			return {
				ok: false,
				errors: { _form: "That submission could not be read." },
			};
		}

		const parsed = formSubmitInput.safeParse(body);
		if (!parsed.success) {
			return {
				ok: false,
				errors: { _form: "That submission was not in the right shape." },
			};
		}

		return this.forms.submit(parsed.data);
	}
}

function respondCors(response: Response): void {
	response.setHeader("cross-origin-resource-policy", "cross-origin");
	response.setHeader("access-control-allow-origin", "*");
	response.setHeader("access-control-allow-methods", "POST, OPTIONS");
	response.setHeader("access-control-allow-headers", "content-type");
}

async function read(
	request: IncomingMessage,
	limit: number,
): Promise<string | null> {
	const existing = (request as { body?: unknown }).body;
	if (typeof existing === "string") {
		return existing.length > limit ? null : existing;
	}
	if (existing && typeof existing === "object") {
		const serialized = JSON.stringify(existing);
		return Buffer.byteLength(serialized, "utf8") > limit ? null : serialized;
	}

	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let settled = false;

		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		request.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > limit) {
				request.destroy();
				finish(null);
				return;
			}
			chunks.push(chunk);
		});

		request.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
		request.on("error", () => finish(null));
	});
}
