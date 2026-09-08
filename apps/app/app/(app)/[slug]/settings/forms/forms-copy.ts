import type { FormFieldType } from "@crm/db/enums";

export const PAGE_TITLE = "Forms";
export const PAGE_DESCRIPTION =
	"A form an owner builds once, then embeds on any website or shares as a link.";

export const NEW_FORM = "New form";
export const NEW_FORM_NAME = "Untitled form";
export const NEW_FORM_EMAIL_LABEL = "Email";

export const EMPTY_TITLE = "No forms yet";
export const EMPTY_BODY =
	"Build a form to turn a stranger's browser into a contact and a lead.";

export const ERROR_TITLE = "We could not load your forms";
export const ERROR_BODY = "Your forms are still there. Try again in a moment.";
export const RETRY = "Try again";

export function submissionCountNote(count: number): string {
	return count === 1 ? "1 submission" : `${count} submissions`;
}

export const BACK = "Back";

export const TAB_BUILD = "Build";
export const TAB_EMBED = "Embed";
export const TAB_SUBMISSIONS = "Submissions";

export const FIELDS_TITLE = "Fields";
export const FIELDS_NOTE =
	"Drag to order. Exactly one email field is required.";
export const ADD_FIELD = "Add field";
export const REMOVE_FIELD = "Remove field";
export const SAVE_FIELDS = "Save fields";
export const DISCARD_FIELDS = "Discard changes";

export const TYPE_LABEL: Record<FormFieldType, string> = {
	TEXT: "Text",
	MESSAGE: "Message",
	EMAIL: "Email",
	PHONE: "Phone",
	ADDRESS: "Address",
	SELECT: "Choice",
};

export const LABEL_LABEL = "Label";
export const TYPE_LABEL_FIELD = "Type";
export const REQUIRED_LABEL = "Required";
export const OPTIONS_LABEL = "Options";
export const ADD_OPTION = "Add option";
export const CONTACT_FIELD_LABEL = "Save to contact field";
export const CONTACT_FIELD_NONE = "Don't save";
export const CONTACT_FIELD_PLACEHOLDER = "Choose a contact field";

export const NEED_ONE_EMAIL =
	"A form needs exactly one email field — it's the dedupe key.";
export const NEED_LABELS = "Every field needs a label.";
export const TOO_MANY_FIELDS = "A form can have at most 30 fields.";

export const SETTINGS_TITLE = "Settings";
export const NAME_LABEL = "Name";
export const INTRO_LABEL = "Intro";
export const BUTTON_LABEL_LABEL = "Button label";
export const CONFIRMATION_LABEL = "Confirmation";
export const CREATE_LEAD_LABEL = "Create a lead on submit";
export const CREATE_LEAD_HELP =
	"Opens a deal on your default pipeline for every new contact this form files.";
export const NOTIFY_EMAILS_LABEL = "Notify these emails";
export const NOTIFY_EMAILS_PLACEHOLDER = "owner@example.com, sales@example.com";
export const NOTIFY_EMAILS_HELP =
	"Leave empty to notify every owner and admin instead.";
export const ACTIVE_LABEL = "Active";

export const PREVIEW_TITLE = "Preview";
export const PREVIEW_NOTE =
	"What a visitor sees, on your site or the hosted link.";

export const EMBED_TITLE = "Embed";
export const EMBED_SNIPPET_LABEL = "Paste this on any page";
export const HOSTED_LINK_LABEL = "Or share the hosted link";
export const COPY = "Copy";
export const OPEN = "Open";
export const TEST_IT_NOTE =
	"Submit the form yourself once — the answer becomes a real contact, so use an address you can delete later.";

export const SUBMISSIONS_TITLE = "Recent submissions";
export const SUBMISSIONS_EMPTY = "No submissions yet.";

export function statusLabel(
	filedAt: string | Date | null,
	skipReason: string | null,
): string {
	if (filedAt) return "Filed";
	if (skipReason) return "Skipped";
	return "Pending";
}

export const REMOVE_FORM = "Delete form";
export const REMOVE_FORM_BODY =
	"This removes the form for good. A form with submissions is turned off instead.";
export function removeFormTitle(name: string): string {
	return `Delete ${name}?`;
}
export const CANCEL = "Cancel";
