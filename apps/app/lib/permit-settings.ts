import { db } from "@crm/db";
import { readPermitSettings } from "@crm/db/settings";
import { cache } from "react";

export const readInstallPermitSettings = cache(() => readPermitSettings(db));
