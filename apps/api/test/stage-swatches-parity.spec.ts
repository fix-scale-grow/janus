import { describe, expect, it } from "bun:test";
import { STAGE_SWATCHES as SERVER_STAGE_SWATCHES } from "@crm/db/stage-semantics";
import { STAGE_SWATCHES as UI_STAGE_SWATCHES } from "../../app/app/(app)/[slug]/settings/pipeline/stage-swatches";

describe("STAGE_SWATCHES parity", () => {
	it("matches the client swatch-picker constant, in order", () => {
		expect(UI_STAGE_SWATCHES).toEqual(SERVER_STAGE_SWATCHES);
	});
});
