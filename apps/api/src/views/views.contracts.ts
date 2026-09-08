import { viewStateSchema, viewTableId } from "@crm/db/user-views";
import { z } from "zod";

export const viewGetInput = z.object({ tableId: viewTableId });

export type ViewGetInput = z.infer<typeof viewGetInput>;

export const viewSaveInput = z.object({
	tableId: viewTableId,
	state: viewStateSchema,
});

export type ViewSaveInput = z.infer<typeof viewSaveInput>;

export const viewResetInput = z.object({ tableId: viewTableId });

export type ViewResetInput = z.infer<typeof viewResetInput>;
