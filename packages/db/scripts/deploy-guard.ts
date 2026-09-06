const DESTRUCTIVE_PATTERN =
	/drop\s+table|drop\s+column|alter\s+table[^;]*drop/i;

export type DeployDecision =
	| { action: "deploy" }
	| { action: "skip"; reason: string };

export function decideDeploy(
	localNames: string[],
	appliedNames: string[],
	pendingSqlByName: Record<string, string>,
	allowEnv: boolean,
): DeployDecision {
	const local = new Set(localNames);
	const applied = new Set(appliedNames);

	if (allowEnv) return { action: "deploy" };

	const unknownToBranch = appliedNames.filter((name) => !local.has(name));
	if (unknownToBranch.length > 0) {
		return {
			action: "skip",
			reason: `The database has migrations this branch does not know: ${unknownToBranch.join(", ")}. Skipping deploy; dev will run against the existing schema.`,
		};
	}

	const pending = localNames.filter((name) => !applied.has(name));
	const destructivePending = pending.filter((name) =>
		DESTRUCTIVE_PATTERN.test(pendingSqlByName[name] ?? ""),
	);

	if (destructivePending.length > 0) {
		return {
			action: "skip",
			reason: `Pending destructive migrations: ${destructivePending.join(", ")}. Set JANUS_ALLOW_DEPLOY=1 to apply destructive migrations.`,
		};
	}

	return { action: "deploy" };
}
