import { createLoader, parseAsStringLiteral } from "nuqs/server";
import { PERMIT_STATUSES } from "@/lib/permits/permit-status";

export const PERMIT_STATUS_FILTERS = ["all", ...PERMIT_STATUSES] as const;

export type PermitStatusFilter = (typeof PERMIT_STATUS_FILTERS)[number];

export const permitsParsers = {
	permitStatus: parseAsStringLiteral(PERMIT_STATUS_FILTERS).withDefault("all"),
};

export const loadPermitsSearchParams = createLoader(permitsParsers);
