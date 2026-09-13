export const PAGE_TITLE = "Permits";
export const PAGE_DESCRIPTION =
	"Which states pull permits, when a deal opens one, and the playbooks Janus fills them from.";

export const ADMIN_ONLY_NOTE = "Only an owner or an admin can change this.";

export const GENERAL_TITLE = "Permit settings";
export const ENABLE_LABEL = "Track permits";
export const ENABLE_HELP =
	"Turns on the permits module for every deal in this workspace.";

export const STATES_LABEL = "States you pull permits in";
export const STATES_HELP = "A deal in one of these states can open a permit.";

export const TRIGGER_STAGES_LABEL = "Stages that open a permit prompt";
export const TRIGGER_STAGES_HELP =
	"When a deal reaches one of these stages, Janus offers to open a permit.";
export const NO_PIPELINES = "No pipelines yet.";

export const DISCLAIMER_TITLE = "Preparation disclaimer";
export function disclaimerAccepted(name: string | null, date: string): string {
	return name ? `Accepted by ${name} on ${date}.` : `Accepted on ${date}.`;
}
export const DISCLAIMER_NOT_ACCEPTED = "Not yet accepted.";
export const ACCEPT_DISCLAIMER = "Accept the disclaimer";

export const LOCKER_TITLE = "Document locker";
export const LOCKER_DESCRIPTION =
	"Licenses, certificates of insurance and registrations Janus can attach to a permit checklist.";
export const LOCKER_EMPTY = "The locker is empty.";
export const LOCKER_LABEL_LABEL = "Label";
export const LOCKER_KIND_LABEL_TEXT = "Kind";
export const LOCKER_FILE_LABEL = "File";
export const LOCKER_UPLOAD = "Upload";
export const LOCKER_OPEN = "Open";
export const LOCKER_DELETE = "Delete";
export function lockerDeleteTitle(label: string): string {
	return `Delete ${label}?`;
}
export function lockerReferencingNote(count: number): string {
	if (count === 0) return "Not used on any permit.";
	return count === 1 ? "Used on 1 permit." : `Used on ${count} permits.`;
}
export const LOCKER_DELETE_BODY =
	"This removes the file for good. Permits that reference it keep the label only.";
export const LOCKER_UPLOAD_ERROR = "The file could not be uploaded.";
export const LOCKER_DELETE_ERROR = "The file could not be deleted.";

export const PLAYBOOKS_TITLE = "Jurisdiction playbooks";
export const PLAYBOOKS_DESCRIPTION =
	"What Janus knows about pulling a permit in each jurisdiction, by permit type.";
export const PLAYBOOKS_EMPTY = "No jurisdictions yet.";
export function playbookCountNote(count: number): string {
	return count === 1 ? "1 playbook" : `${count} playbooks`;
}
export const NEW_JURISDICTION = "New jurisdiction";
export const JURISDICTION_NAME_LABEL = "Name";
export const JURISDICTION_KIND_LABEL_TEXT = "Kind";
export const JURISDICTION_STATE_LABEL = "State";
export const RESOLVE_JURISDICTION = "Add jurisdiction";
export const BACK = "Back";
export const CANCEL = "Cancel";

export const FACTS_TITLE = "Facts";
export const FACT_UNVERIFIED = "Unverified";
export function factVerifiedBy(name: string): string {
	return `Verified by ${name}`;
}
export const FACT_NOT_SET = "Not set";
export const FACT_VALUE_PLACEHOLDER = "What Janus should tell a rep";
export const FACT_SOURCE_PLACEHOLDER = "Source URL";
export const FACT_CONFIRM = "Confirm";
export const FACT_EDIT = "Edit";
export const FACT_SAVE = "Save";
export const FACT_CLEAR = "Clear";
export const FACT_SOURCE_LINK = "Source";

export const PREREQUISITES_TITLE = "Prerequisites";
export const ADD_PREREQUISITE = "Add prerequisite";
export const PREREQUISITES_EMPTY = "No prerequisites yet.";

export const DOCUMENTS_TITLE = "Required documents";
export const DOCUMENTS_EMPTY = "No required documents yet.";
export const ADD_DOCUMENT = "Add document";
export const DOCUMENT_LABEL_LABEL = "Label";
export const DOCUMENT_REUSABLE_LABEL = "Reusable across permits";
export const DOCUMENT_SOURCE_LABEL = "Source URL";
export const SAVE_DOCUMENTS = "Save documents";

export const INSPECTIONS_TITLE = "Inspections";
export const INSPECTIONS_EMPTY = "No inspections yet.";
export const ADD_INSPECTION = "Add inspection";
export const INSPECTION_NAME_LABEL = "Name";
export const INSPECTION_WHEN_LABEL = "When";
export const INSPECTION_NOTE_LABEL = "Critical note";
export const SAVE_INSPECTIONS = "Save inspections";
export const REMOVE = "Remove";

export const WORKSHEET_TITLE = "Worksheet template";
export const WORKSHEET_DESCRIPTION =
	"The fields a rep fills to prepare this permit.";
export const WORKSHEET_EMPTY = "No fields yet.";
export const ADD_FIELD = "Add field";
export const FIELD_LABEL_LABEL = "Label";
export const FIELD_TYPE_LABEL = "Type";
export const FIELD_PREFILL_LABEL = "Prefill from";
export const FIELD_PREFILL_NONE = "None";
export const FIELD_REQUIRED_LABEL = "Required";
export function removeFieldTitle(label: string): string {
	return `Remove ${label}?`;
}
export const REMOVE_FIELD_BODY =
	"This removes the field from the template. Answers already given are not deleted.";
export const REMOVE_FIELD = "Remove field";

export const SELECT_TYPE_LABEL_LABEL = "Describe this type";
