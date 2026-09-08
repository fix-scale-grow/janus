import { db } from "@crm/db";
import { readBrandTheme } from "@crm/db/brand";
import { cache } from "react";

export const readInstallBrandTheme = cache(() => readBrandTheme(db));
