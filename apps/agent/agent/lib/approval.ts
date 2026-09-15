import type { Approval, ApprovalContext } from "eve/tools";
import { APP_AUTH } from "./app-auth";

export function isAutomated(session: {
	auth: {
		current?: {
			authenticator?: string;
			principalId?: string;
			principalType?: string;
		} | null;
	};
}): boolean {
	const auth = session.auth.current;
	return (
		auth?.authenticator === APP_AUTH.authenticator &&
		auth.principalId === APP_AUTH.principalId &&
		auth.principalType === APP_AUTH.principalType
	);
}

export type WriteGuard = (
	session: ApprovalContext["session"],
	toolInput: unknown,
) => Promise<string | null>;

export function sensitiveWrite(instead: string, guard?: WriteGuard): Approval {
	return async ({ session, toolInput }) => {
		if (isAutomated(session)) {
			return {
				type: "denied" as const,
				reason: `Not something to do unattended. ${instead}`,
			};
		}
		if (!guard) return "user-approval";
		try {
			const blocked = await guard(session, toolInput);
			return blocked
				? { type: "denied" as const, reason: blocked }
				: "user-approval";
		} catch (error) {
			return {
				type: "denied" as const,
				reason: error instanceof Error ? error.message : String(error),
			};
		}
	};
}
