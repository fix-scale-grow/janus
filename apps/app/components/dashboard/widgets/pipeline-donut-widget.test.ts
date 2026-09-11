import { expect, test } from "bun:test";
import { stageHref } from "./pipeline-donut-widget";

const workspaceUrl = (path?: string) => `/acme${path ?? ""}`;

test("appends the pipeline when one is selected", () => {
	expect(stageHref(workspaceUrl, { key: "stage-1" }, "pipeline-1")).toBe(
		"/acme/deals?stage=stage-1&pipeline=pipeline-1",
	);
});

test("appends nothing when the pipeline id is null", () => {
	expect(stageHref(workspaceUrl, { key: "stage-1" }, null)).toBe(
		"/acme/deals?stage=stage-1",
	);
});
