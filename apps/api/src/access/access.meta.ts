import type { AccessArea } from "@crm/db/access-config";
import type { AccessNeed } from "@crm/db/access-policy";

export type AccessTag =
	| {
			kind: "area";
			area: AccessArea;
			need: AccessNeed | readonly AccessNeed[];
			field: boolean;
	  }
	| { kind: "admin"; field: false }
	| { kind: "member"; field: boolean };

export type AccessMeta = { access: AccessTag };

export function access(
	area: AccessArea,
	need: AccessNeed | readonly AccessNeed[],
	opts: { field?: boolean } = {},
): AccessMeta {
	return { access: { kind: "area", area, need, field: opts.field ?? false } };
}

export function adminOnly(): AccessMeta {
	return { access: { kind: "admin", field: false } };
}

export function anyMember(opts: { field?: boolean } = {}): AccessMeta {
	return { access: { kind: "member", field: opts.field ?? false } };
}
