import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";
import type { MailerConfig } from "./mailer.config";
import { MAILER_CONFIG } from "./mailer.constants";

export interface MailAttachment {
	filename: string;
	content: Buffer;
	contentType?: string;
}

export interface SendMailInput {
	to: string;
	subject: string;
	text: string;
	html?: string;
	attachments?: MailAttachment[];
}

export interface SendMailResult {
	delivered: boolean;
}

@Injectable()
export class MailerService {
	private readonly logger = new Logger(MailerService.name);

	constructor(@Inject(MAILER_CONFIG) private readonly config: MailerConfig) {}

	isConfigured(): boolean {
		return this.config.transport !== null;
	}

	async send(input: SendMailInput): Promise<SendMailResult> {
		if (this.config.transport === "file") {
			return this.sendToFile(this.config.outboxDir, this.config.from, input);
		}

		if (this.config.transport === "smtp") {
			return this.sendViaSmtp(this.config, input);
		}

		this.logger.warn({ message: "Mail not sent, no transport configured" });
		return { delivered: false };
	}

	private async sendViaSmtp(
		config: Extract<MailerConfig, { transport: "smtp" }>,
		input: SendMailInput,
	): Promise<SendMailResult> {
		const transporter = createTransport({
			host: config.smtp.host,
			port: config.smtp.port,
			secure: config.smtp.secure,
			auth:
				config.smtp.user && config.smtp.pass
					? { user: config.smtp.user, pass: config.smtp.pass }
					: undefined,
		});

		try {
			await transporter.sendMail({
				from: config.from,
				to: input.to,
				subject: input.subject,
				text: input.text,
				html: input.html,
				attachments: input.attachments?.map((attachment) => ({
					filename: attachment.filename,
					content: attachment.content,
					contentType: attachment.contentType,
				})),
			});

			this.logger.log({ message: "Mail sent", transport: "smtp" });
			return { delivered: true };
		} catch (error) {
			this.logger.error(
				{ message: "Mail send failed", transport: "smtp" },
				error instanceof Error ? error.stack : undefined,
			);
			return { delivered: false };
		}
	}

	private async sendToFile(
		outboxDir: string,
		from: string | null,
		input: SendMailInput,
	): Promise<SendMailResult> {
		const slug = slugify(input.subject);
		const dir = join(outboxDir, `${Date.now()}-${slug}`);

		try {
			await mkdir(dir, { recursive: true });

			const attachments = input.attachments ?? [];

			await Promise.all(
				attachments.map((attachment) =>
					writeFile(join(dir, attachment.filename), attachment.content),
				),
			);

			await writeFile(
				join(dir, "envelope.json"),
				JSON.stringify(
					{
						to: input.to,
						from,
						subject: input.subject,
						text: input.text,
						html: input.html ?? null,
						attachments: attachments.map((attachment) => ({
							filename: attachment.filename,
							bytes: attachment.content.byteLength,
						})),
					},
					null,
					2,
				),
			);

			this.logger.log({ message: "Mail sent", transport: "file" });
			return { delivered: true };
		} catch (error) {
			this.logger.error(
				{ message: "Mail send failed", transport: "file" },
				error instanceof Error ? error.stack : undefined,
			);
			return { delivered: false };
		}
	}
}

function slugify(subject: string): string {
	const slug = subject
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "message";
}
