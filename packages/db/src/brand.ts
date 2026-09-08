import type { Db } from "./client";
import { WORKSPACE_ID } from "./workspace";

export {
	BRAND_TOKEN_VARS,
	type BrandThemeOptions,
	brandThemeCss,
	normalizeHex,
	readableForeground,
	relativeLuminance,
} from "./brand-color";

export type BrandTheme = {
	brandColor: string | null;
	logo: string | null;
	name: string;
};

export async function readBrandTheme(db: Db): Promise<BrandTheme | null> {
	const row = await db.organization.findUnique({
		where: { id: WORKSPACE_ID },
		select: { brandColor: true, logo: true, name: true },
	});

	return row ?? null;
}
