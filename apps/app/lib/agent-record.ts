import type { CarbonIcon } from "@crm/ui/components/icon";

export type AgentRecordKind = "contact" | "deal" | "drawing" | "workspace";

export type AgentRecord = { kind: AgentRecordKind; id: string };

type RecordCopy = {
	header?: string;
	field?: "contactId" | "dealId" | "drawingId";
	title: string;
	blurb: string;
	placeholder: string;
	suggestions: string[];
};

const COPY: Record<AgentRecordKind, RecordCopy> = {
	contact: {
		header: "x-crm-contact",
		field: "contactId",
		title: "Ask about this person",
		blurb:
			"Every step is shown as it happens — including the leads it throws away.",
		placeholder: "Are they still there?",
		suggestions: [
			"Who is this person?",
			"Are they still there?",
			"What should I know before a call?",
		],
	},
	deal: {
		header: "x-crm-deal",
		field: "dealId",
		title: "Ask about this deal",
		blurb:
			"It can read the thread, the meetings and the people on both sides of it.",
		placeholder: "Where has this stalled?",
		suggestions: [
			"Where does this stand?",
			"Who else should be involved?",
			"What is the risk here?",
		],
	},
	drawing: {
		header: "x-crm-drawing",
		field: "drawingId",
		title: "Ask about this drawing",
		blurb:
			"It can read every shape on it, what it prices against, and any estimate already generated from it.",
		placeholder: "What's still unassigned?",
		suggestions: [
			"What's still unassigned?",
			"What will this come to?",
			"What did the customer write on it?",
		],
	},
	workspace: {
		title: "Ask Janus",
		blurb:
			"It can read your pipelines, deals, drawings and estimates — ask it anything about the business.",
		placeholder: "Which deals stalled this week?",
		suggestions: [
			"Which deals stalled this week?",
			"What closed this month?",
			"What needs my attention today?",
		],
	},
};

export function recordCopy(kind: AgentRecordKind): RecordCopy {
	return COPY[kind];
}

export function recordHeader(record: AgentRecord): Record<string, string> {
	const header = COPY[record.kind].header;
	return header ? { [header]: record.id } : {};
}

export function recordFilter(record: AgentRecord): {
	kind?: "WORKSPACE";
	contactId?: string;
	dealId?: string;
	drawingId?: string;
} {
	const field = COPY[record.kind].field;
	if (!field) return { kind: "WORKSPACE" };
	return { [field]: record.id };
}

export type { CarbonIcon };
