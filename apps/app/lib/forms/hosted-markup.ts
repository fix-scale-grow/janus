import type { PublicFormConfig, PublicFormField } from "@crm/db/forms";

export function fieldsMarkup(config: PublicFormConfig): string {
	const intro = config.intro ? `<p>${escapeHtml(config.intro)}</p>` : "";
	const fields = config.fields.map(fieldMarkup).join("");
	const button = escapeHtml(config.buttonLabel || "Send");

	return `${intro}<h1>${escapeHtml(config.name)}</h1><form>${fields}<input type="text" name="website_url" class="jf-hp" tabindex="-1" autocomplete="off" aria-hidden="true"><div class="jf-err"></div><button type="submit">${button}</button></form>`;
}

function fieldMarkup(field: PublicFormField): string {
	const id = `jf-${escapeHtml(field.id)}`;
	const label = `<label for="${id}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>`;
	const required = field.required ? " required" : "";

	let input: string;
	if (field.type === "MESSAGE") {
		input = `<textarea id="${id}" rows="3"${required}></textarea>`;
	} else if (field.type === "SELECT") {
		const options = (field.options ?? [])
			.map(
				(option) =>
					`<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`,
			)
			.join("");
		input = `<select id="${id}"${required}><option value="">Select…</option>${options}</select>`;
	} else {
		const type =
			field.type === "EMAIL"
				? "email"
				: field.type === "PHONE"
					? "tel"
					: "text";
		input = `<input id="${id}" type="${type}"${required}>`;
	}

	return `<div data-field="${escapeHtml(field.id)}">${label}${input}<div class="jf-err"></div></div>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
