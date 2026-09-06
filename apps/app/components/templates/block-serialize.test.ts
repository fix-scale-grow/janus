import { beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	fieldChipHtml,
	serializeBlockHtml,
	serializeBlockText,
	toEditorHtml,
	toEditorText,
} from "./block-serialize";

beforeAll(() => {
	if (typeof globalThis.document === "undefined") GlobalRegistrator.register();
});

function mount(html: string): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

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

	it("leaves an encoded href encoded once", () => {
		const stored = '<a href="https://example.com/?a=1&amp;b=2">Open</a>';

		expect(toEditorHtml(stored)).toBe(stored);
		expect(toEditorHtml(toEditorHtml(stored))).toBe(stored);
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

describe("serializeBlockHtml", () => {
	const samples = [
		"Plain words.",
		"Hi {{contact.first_name}}, your total is {{estimate.total}}.",
		"One<br>two<br><br>three",
		'<b>Bold</b> and <i>italic</i> and <a href="https://example.com">a link</a>',
		"{{personal_note}}<br>Reply to this email.<br>{{sender.name}}, {{business.name}}",
	];

	for (const stored of samples) {
		it(`round trips ${stored.slice(0, 24)}`, () => {
			const once = serializeBlockHtml(mount(toEditorHtml(stored)));
			const twice = serializeBlockHtml(mount(toEditorHtml(once)));

			expect(once).toBe(
				stored.replace(
					/\{\{([a-z_.]+)\}\}/g,
					(_m, token) => `<span data-field="${token}">{{${token}}}</span>`,
				),
			);
			expect(twice).toBe(once);
		});
	}

	it("reads one div per line as line breaks", () => {
		expect(serializeBlockHtml(mount("abc<div>d</div><div>e</div>"))).toBe(
			"abc<br>d<br>e",
		);
	});

	it("reads an empty div line as one break", () => {
		const root = mount("abc<div><br></div><div>d</div>");
		const once = serializeBlockHtml(root);

		expect(once).toBe("abc<br><br>d");
		expect(serializeBlockHtml(mount(toEditorHtml(once)))).toBe(once);
	});

	it("keeps a chip and drops the chip label", () => {
		const root = mount(toEditorHtml("Hi {{contact.first_name}}"));

		expect(serializeBlockHtml(root)).toBe(
			'Hi <span data-field="contact.first_name">{{contact.first_name}}</span>',
		);
	});

	it("escapes a typed angle bracket", () => {
		const root = document.createElement("div");
		root.append(document.createTextNode("a < b & c"));

		expect(serializeBlockHtml(root)).toBe("a &lt; b &amp; c");
	});

	it("drops an unknown element but keeps its words", () => {
		expect(serializeBlockHtml(mount("<u>kept</u>"))).toBe("kept");
	});
});

describe("serializeBlockText", () => {
	it("gives a chip back as its token", () => {
		const root = mount(toEditorText("Your estimate {{estimate.title}}"));

		expect(serializeBlockText(root)).toBe("Your estimate {{estimate.title}}");
	});

	it("collapses a line break to one space", () => {
		expect(serializeBlockText(mount("one<div>two</div>"))).toBe("one two");
	});
});
