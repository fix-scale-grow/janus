import { FORMS } from "@crm/db/forms";

export const NOTIFY_ROLES = ["owner", "admin"] as const;

export function formSubmitWindowKey(at: Date = new Date()): string {
	return `rate:${Math.floor(at.getTime() / 60_000)}:form-submit`;
}

export const FORMS_SUBMIT_PER_MINUTE = FORMS.submit.perMinute;

export const RATE_LIMITED_REASON =
	"Too many submissions right now — try again in a minute.";

export const BOT_SUPPRESSED_CONFIRMATION = { ok: true } as const;
