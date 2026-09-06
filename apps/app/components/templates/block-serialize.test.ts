import { describe, expect, it } from "bun:test";
import { fieldChipHtml, toEditorHtml, toEditorText } from "./block-serialize";

describe("toEditorHtml", () => {
	it("turns a bare token into a chip", () => {
		const html = toEditorHtml("Hi {{contact.first_name}}, welcome.");

		expect(html).toContain('data-field="contact.first_name"');
		expect(html).toContain("First name");
		expect(html).not.toContain("{{contact.first_name}}");
	});

	it("keeps a stored chip span as one chip", () => {
		const stored =
			'Hi <span data-field="contact.first_name">{{contact.first_name}}</span>.';
		const html = toEditorHtml(stored);

		expect(html).toBe(`Hi ${fieldChipHtml("contact.first_name")}.`);
	});

	it("keeps the allowed inline tags and drops the rest", () => {
		const html = toEditorHtml("<b>Bold</b><br><img src=x><i>Italic</i>");

		expect(html).toBe("<b>Bold</b><br><i>Italic</i>");
	});

	it("drops a link with an unsupported scheme", () => {
		const html = toEditorHtml('<a href="javascript:alert(1)">Tap</a>');

		expect(html).toBe("<a>Tap</a>");
	});
});

describe("toEditorText", () => {
	it("escapes markup and chips the tokens", () => {
		const text = toEditorText("<b> {{business.name}}");

		expect(text).toContain("&lt;b&gt;");
		expect(text).toContain('data-field="business.name"');
	});

	it("shows an unknown token as itself", () => {
		expect(toEditorText("{{nope.here}}")).toContain("{{nope.here}}");
	});
});
