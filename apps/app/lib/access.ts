"use client";

import type { AccessArea, MoneySwitch } from "@crm/db/access-config";
import type { AccessNeed } from "@crm/db/access-policy";
import { useQuery } from "@tanstack/react-query";
import { canArea, canMoney, type MyAccess } from "./access-rules";
import { useTRPC } from "./trpc/client";

export type { MyAccess };

export function useAccess(): {
	mine: MyAccess | undefined;
	can: (area: AccessArea, need: AccessNeed) => boolean;
	money: (sw: MoneySwitch) => boolean;
	isField: boolean;
	isAdmin: boolean;
} {
	const trpc = useTRPC();
	const { data: mine } = useQuery(trpc.permissions.mine.queryOptions());

	return {
		mine: mine as MyAccess | undefined,
		can: (area, need) => (mine ? canArea(mine as MyAccess, area, need) : false),
		money: (sw) => (mine ? canMoney(mine as MyAccess, sw) : false),
		isField: mine?.surface === "FIELD",
		isAdmin: mine?.isAdmin ?? false,
	};
}
