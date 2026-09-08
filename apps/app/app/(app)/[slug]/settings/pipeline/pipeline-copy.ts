export const PAGE_TITLE = "Pipeline";
export const PAGE_DESCRIPTION =
	"The stages a deal moves through, and what winning and losing mean here.";

export const NEW_PIPELINE = "New pipeline";
export const NEW_PIPELINE_NAME = "New pipeline";
export const NEW_STAGE = "New stage";
export const NEW_STAGE_LABEL = "New stage";

export const ARCHIVE_PIPELINE = "Archive pipeline";
export const RESTORE = "Restore";
export const DELETE_STAGE = "Delete";
export const ARCHIVE_STAGE = "Archive";
export const RESTORE_STAGE = "Restore";
export const CANCEL = "Cancel";

export const ARCHIVED_PIPELINES = "Archived pipelines";
export const ARCHIVED_PIPELINES_NOTE = "no open deals, kept for history";
export const ARCHIVED_STAGES = "Archived stages";
export const ARCHIVED_STAGES_NOTE = "hidden, history keeps the label";

export const DRAG_NOTE = "Drag to order";
export const ENTRY_LABEL = "Entry stage";
export const ENTRY_HELP = "Where a new deal lands.";
export const ENTRY_DISABLED_HELP = "Only an open stage can be the entry.";
export const MAKE_ENTRY = "Make this the entry stage";

export const OUTCOME_LABEL: Record<
	"OPEN" | "WON" | "LOST" | "DISQUALIFIED",
	string
> = {
	OPEN: "Open",
	WON: "Won",
	LOST: "Lost",
	DISQUALIFIED: "Disqualified",
};

export const STAGE_COLOR_LABEL = "Stage color";

export const EMPTY_TITLE = "No pipelines yet";
export const EMPTY_BODY = "Create a pipeline to give deals somewhere to go.";

export const ERROR_TITLE = "We could not load your pipelines";
export const ERROR_BODY =
	"Your pipelines are still there. Try again in a moment.";
export const RETRY = "Try again";

export function stageCountNote(count: number): string {
	return count === 1 ? "1 stage" : `${count} stages`;
}

export function archivePipelineTitle(name: string): string {
	return `Archive ${name}?`;
}

export const ARCHIVE_PIPELINE_BODY =
	"Its deals keep their stages and stay reachable from All-pipelines views. You can restore it any time.";

export function deleteStageTitle(label: string): string {
	return `Delete ${label}?`;
}

export const DELETE_STAGE_BODY =
	"This removes the stage for good. If any deal ever used it, delete is refused — archive it instead.";
