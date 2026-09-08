import { db, type Prisma } from "@crm/db";
import type { CrmEventInput } from "../src/agent/agent-trigger.service";

export function withDiscardedCrmEvents<Result>(
	work: (
		tx: Prisma.TransactionClient,
		emit: (input: CrmEventInput) => Promise<void>,
	) => Promise<Result>,
): Promise<Result> {
	return db.$transaction((tx) => work(tx, async () => undefined));
}

export function withCapturedCrmEvents(sink: CrmEventInput[]) {
	return function withCrmEvents<Result>(
		work: (
			tx: Prisma.TransactionClient,
			emit: (input: CrmEventInput) => Promise<void>,
		) => Promise<Result>,
	): Promise<Result> {
		return db.$transaction((tx) =>
			work(tx, async (input) => {
				sink.push(input);
			}),
		);
	};
}
