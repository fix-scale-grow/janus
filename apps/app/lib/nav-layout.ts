import { db } from "@crm/db";
import { readNavLayout } from "@crm/db/settings";
import { cache } from "react";

export const readInstallNavLayout = cache(() => readNavLayout(db));
