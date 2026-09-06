import { describe, expect, it } from "bun:test";
import {
	initialSceneChangeState,
	nextSceneChange,
} from "../components/drawings/scene-change";

describe("nextSceneChange", () => {
	it("does not save the scene the editor mounted with", () => {
		const first = nextSceneChange(initialSceneChangeState(), 41);

		expect(first.save).toBe(false);
		expect(first.state.version).toBe(41);
	});

	it("saves an edit made after the mount", () => {
		const mounted = nextSceneChange(initialSceneChangeState(), 41);
		const edited = nextSceneChange(mounted.state, 42);

		expect(edited.save).toBe(true);
		expect(edited.state.version).toBe(42);
	});

	it("does not save when the version repeats", () => {
		const mounted = nextSceneChange(initialSceneChangeState(), 41);
		const edited = nextSceneChange(mounted.state, 42);
		const repeat = nextSceneChange(edited.state, 42);

		expect(repeat.save).toBe(false);
	});

	it("saves when the version is unknown after the mount", () => {
		const mounted = nextSceneChange(initialSceneChangeState(), null);
		const edited = nextSceneChange(mounted.state, null);

		expect(mounted.save).toBe(false);
		expect(edited.save).toBe(true);
	});

	it("does not save a mount whose version is unknown", () => {
		const mounted = nextSceneChange(initialSceneChangeState(), null);

		expect(mounted.save).toBe(false);
	});
});
