import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";
import { MailTransport } from "../config/env.validation";

export const MAILER = {
	defaultOutboxDirName: join("data", "mail-outbox"),
	defaultSmtpPort: 587,
} as const;

export interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user?: string;
	pass?: string;
}

export type MailerConfig =
	| { transport: "file"; outboxDir: string; from: string | null }
	| { transport: "smtp"; smtp: SmtpConfig; from: string }
	| { transport: null };

function outboxDir(): string {
	const configured = process.env.MAIL_OUTBOX_DIR?.trim();
	if (configured) return configured;

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, MAILER.defaultOutboxDirName);
}

function isTrue(value: string | undefined): boolean {
	return value?.trim().toLowerCase() === "true";
}

function smtpFrom(env: NodeJS.ProcessEnv): SmtpConfig | null {
	const host = env.SMTP_HOST?.trim();
	if (!host) return null;

	return {
		host,
		port: Number(env.SMTP_PORT) || MAILER.defaultSmtpPort,
		secure: isTrue(env.SMTP_SECURE),
		user: env.SMTP_USER?.trim() || undefined,
		pass: env.SMTP_PASS?.trim() || undefined,
	};
}

export function resolveMailerConfig(
	env: NodeJS.ProcessEnv = process.env,
): MailerConfig {
	const requested = env.MAIL_TRANSPORT?.trim().toLowerCase();
	const from = env.MAIL_FROM?.trim();

	if (requested === MailTransport.File) {
		return { transport: "file", outboxDir: outboxDir(), from: from ?? null };
	}

	const smtp = smtpFrom(env);
	if (!smtp || !from) return { transport: null };

	return { transport: "smtp", smtp, from };
}
