import { db, EnrichmentStatus } from "@crm/db";
import type { TaskSubject } from "./tasks";

type SettleGuard = {
	enrichmentStatus?: EnrichmentStatus;
	OR?: Array<{
		enrichmentStatus: EnrichmentStatus;
		updatedAt?: { lt: Date };
	}>;
};

export async function markRunning(subject: TaskSubject): Promise<void> {
	await write(subject, EnrichmentStatus.RUNNING, null, false);
}

export async function settle(
	subject: TaskSubject,
	status: EnrichmentStatus,
	error?: string,
): Promise<void> {
	await write(subject, status, error ?? null, true);
}

async function write(
	subject: TaskSubject,
	status: EnrichmentStatus,
	error: string | null,
	onlyIfRunning: boolean,
): Promise<void> {
	if (!subject.contactId) return;

	const data = {
		enrichmentStatus: status,
		enrichmentError: error,
		...(status === EnrichmentStatus.COMPLETE ? { enrichedAt: new Date() } : {}),
	};

	const guard: SettleGuard = onlyIfRunning
		? await settleable(subject, status)
		: {};

	await db.contact.updateMany({
		where: { id: subject.contactId, ...guard },
		data,
	});
}

async function settleable(
	subject: TaskSubject,
	status: EnrichmentStatus,
): Promise<SettleGuard> {
	const running = { enrichmentStatus: EnrichmentStatus.RUNNING };
	if (status !== EnrichmentStatus.FAILED) return running;

	const endedAt = await taskEndedAt(subject.id);
	if (!endedAt) return running;
	if (await hasOpenRequest(subject)) return running;

	return {
		OR: [
			running,
			{
				enrichmentStatus: EnrichmentStatus.PENDING,
				updatedAt: { lt: endedAt },
			},
		],
	};
}

async function taskEndedAt(taskId: string): Promise<Date | null> {
	const task = await db.agentTask.findUnique({
		where: { id: taskId },
		select: { finishedAt: true },
	});

	return task?.finishedAt ?? null;
}

async function hasOpenRequest(subject: TaskSubject): Promise<boolean> {
	if (!subject.contactId) return false;

	const open = await db.agentTask.findFirst({
		where: {
			id: { not: subject.id },
			finishedAt: null,
			contactId: subject.contactId,
		},
		select: { id: true },
	});

	return open !== null;
}
