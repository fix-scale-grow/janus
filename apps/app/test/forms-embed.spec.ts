import { describe, expect, test } from "bun:test";
import { brotliCompressSync } from "node:zlib";
import { FORMS, type PublicFormConfig } from "@crm/db/forms";
import { formSource } from "@/lib/forms/embed";
import { fieldsMarkup } from "@/lib/forms/hosted-markup";

const ENDPOINT = "https://forms.example.com/api/f/s";

const CONFIG: PublicFormConfig = {
	id: "cm2test0000000000000001",
	name: "Get a quote",
	intro: "Tell us about your roof.",
	buttonLabel: "Send",
	confirmation: "Thanks — we'll be in touch shortly.",
	brandColor: "#1a73e8",
	fields: [
		{ id: "f1", type: "TEXT", label: "Name", required: true },
		{ id: "f2", type: "EMAIL", label: "Email", required: true },
		{ id: "f3", type: "PHONE", label: "Phone", required: false },
		{
			id: "f4",
			type: "SELECT",
			label: "Roof type",
			required: false,
			options: ["Shingle", "Metal", "Tile"],
		},
		{ id: "f5", type: "MESSAGE", label: "Details", required: false },
	],
};

interface FakeNode {
	tagName: string;
	attrs: Record<string, string>;
	style: { cssText: string };
	children: FakeNode[];
	listeners: Record<string, Array<(ev: unknown) => void>>;
	className: string;
	value: string;
	type: string;
	rows: number;
	disabled: boolean;
	shadowRoot?: FakeNode;
	appendChild(child: FakeNode): FakeNode;
	removeChild(child: FakeNode): FakeNode;
	setAttribute(key: string, value: string): void;
	getAttribute(key: string): string | null;
	addEventListener(type: string, fn: (ev: unknown) => void): void;
	attachShadow(opts: { mode: string }): FakeNode;
	readonly firstChild: FakeNode | null;
	textContent: string;
}

function fakeElement(tag: string): FakeNode {
	let text = "";

	const node = {
		tagName: tag.toUpperCase(),
		attrs: {},
		style: { cssText: "" },
		children: [],
		listeners: {},
		className: "",
		value: "",
		type: "",
		rows: 0,
		disabled: false,
		appendChild(child: FakeNode) {
			node.children.push(child);
			return child;
		},
		removeChild(child: FakeNode) {
			const index = node.children.indexOf(child);
			if (index > -1) node.children.splice(index, 1);
			return child;
		},
		setAttribute(key: string, value: string) {
			node.attrs[key] = value;
		},
		getAttribute(key: string) {
			return key in node.attrs ? (node.attrs[key] ?? null) : null;
		},
		addEventListener(type: string, fn: (ev: unknown) => void) {
			if (!node.listeners[type]) node.listeners[type] = [];
			node.listeners[type]?.push(fn);
		},
		attachShadow() {
			const root = fakeElement("shadow-root");
			node.shadowRoot = root;
			return root;
		},
		get firstChild() {
			return node.children[0] ?? null;
		},
		get textContent() {
			return text;
		},
		set textContent(value: string) {
			text = value;
		},
	} as unknown as FakeNode;

	return node;
}

function collect(
	root: FakeNode,
	predicate: (node: FakeNode) => boolean,
): FakeNode[] {
	const out: FakeNode[] = [];

	const walk = (node: FakeNode) => {
		if (predicate(node)) out.push(node);
		for (const child of node.children) walk(child);
	};

	walk(root);
	return out;
}

function fakeDocument(opts: {
	target?: FakeNode;
	cookie?: string;
	referrer?: string;
	location?: { pathname: string; search: string; hostname: string };
}) {
	const body = fakeElement("body");

	return {
		cookie: opts.cookie ?? "",
		referrer: opts.referrer ?? "",
		location: opts.location ?? {
			pathname: "/contact",
			search: "",
			hostname: "example.com",
		},
		body,
		createElement: (tag: string) => fakeElement(tag),
		querySelector: (selector: string) => {
			const id = opts.target?.attrs["data-janus-form"];
			return id && selector.indexOf(id) > -1 ? opts.target : null;
		},
	};
}

async function flush(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubFetch(handler: (url: string, init: RequestInit) => unknown) {
	const original = globalThis.fetch;
	const calls: Array<{ url: string; init: RequestInit }> = [];

	globalThis.fetch = ((url: string, init: RequestInit) => {
		calls.push({ url, init });
		return Promise.resolve(handler(url, init));
	}) as typeof fetch;

	return {
		calls,
		restore: () => {
			globalThis.fetch = original;
		},
	};
}

function mountInline(config: PublicFormConfig = CONFIG) {
	const target = fakeElement("div");
	target.setAttribute("data-janus-form", config.id);
	const doc = fakeDocument({ target });

	new Function("document", formSource(config, ENDPOINT))(doc);

	return { target, doc, root: target.shadowRoot as FakeNode };
}

describe("the form embed stays inside its budget", () => {
	test("brotli-compressed source stays under the promised size", () => {
		const source = formSource(CONFIG, ENDPOINT);
		const size = brotliCompressSync(Buffer.from(source, "utf8")).length;

		expect(size).toBeLessThanOrEqual(FORMS.embedBudgetBytes);
	});
});

describe("the form embed renders", () => {
	test("inline into the data-janus-form target when one is present", () => {
		const { root } = mountInline();

		expect(root).toBeTruthy();

		const labels = collect(root, (node) => node.tagName === "LABEL").map(
			(node) => node.textContent,
		);

		expect(labels).toContain("Name *");
		expect(labels).toContain("Email *");
		expect(labels).toContain("Phone");
		expect(labels).toContain("Roof type");
		expect(labels).toContain("Details");
	});

	test("a floating launcher when no target is present on the page", () => {
		const doc = fakeDocument({});

		new Function("document", formSource(CONFIG, ENDPOINT))(doc);

		expect(doc.body.children.length).toBe(1);

		const host = doc.body.children[0] as FakeNode;
		expect(host.shadowRoot).toBeTruthy();

		const buttons = collect(
			host.shadowRoot as FakeNode,
			(node) => node.className.indexOf("jf-btn") > -1,
		);
		expect(buttons.length).toBe(1);
	});

	test("a visible honeypot input, never type=hidden", () => {
		const { root } = mountInline();

		const honeypots = collect(
			root,
			(node) => node.className.indexOf("jf-hp") > -1,
		);

		expect(honeypots.length).toBe(1);
		expect(honeypots[0]?.type).toBe("text");
		expect((honeypots[0] as unknown as { name: string })?.name).toBe(
			"website_url",
		);
	});
});

describe("the form embed submits", () => {
	test("the right payload shape", async () => {
		const { root, doc } = mountInline();
		const fetchStub = stubFetch(() => ({
			ok: true,
			json: () => ({ ok: true }),
		}));

		try {
			const form = collect(root, (node) => node.tagName === "FORM")[0];
			const inputs = collect(
				root,
				(node) =>
					["INPUT", "SELECT", "TEXTAREA"].includes(node.tagName) &&
					node.className.indexOf("jf-hp") === -1,
			);

			expect(form).toBeTruthy();
			expect(inputs.length).toBe(CONFIG.fields.length);

			const [nameInput, emailInput, phoneInput, roofInput, detailsInput] =
				inputs;
			if (
				!nameInput ||
				!emailInput ||
				!phoneInput ||
				!roofInput ||
				!detailsInput
			) {
				throw new Error("Expected all five field inputs to be rendered.");
			}
			nameInput.value = "Jane Doe";
			emailInput.value = "jane@example.com";
			phoneInput.value = "555-1234";
			roofInput.value = "Metal";
			detailsInput.value = "Leaky roof after last storm.";

			for (const fn of form?.listeners.submit ?? []) {
				fn({ preventDefault: () => {} });
			}

			await flush();

			expect(fetchStub.calls.length).toBe(1);
			const call = fetchStub.calls[0];
			if (!call) throw new Error("Expected the embed to have called fetch.");

			expect(call.url).toBe(ENDPOINT);
			expect(call.init.method).toBe("POST");
			const headers = call.init.headers as Record<string, string>;
			expect(headers["content-type"]).toBe("application/json");

			const payload = JSON.parse(call.init.body as string);

			expect(payload.formId).toBe(CONFIG.id);
			expect(payload.answers).toEqual({
				f1: "Jane Doe",
				f2: "jane@example.com",
				f3: "555-1234",
				f4: "Metal",
				f5: "Leaky roof after last storm.",
			});
			expect(payload.honeypot).toBe("");
			expect(typeof payload.renderedAt).toBe("number");
			expect(payload.host).toBe("example.com");
			expect(payload.path).toBe("/contact");
			expect(payload.touch.landing).toBe("/contact");
			expect(typeof payload.touch.at).toBe("number");
			expect(payload.firstTouch).toBeTruthy();

			void doc;
		} finally {
			fetchStub.restore();
		}
	});

	test("swaps to the confirmation copy on ok:true", async () => {
		const { root } = mountInline();
		const fetchStub = stubFetch(() => ({
			ok: true,
			json: () => ({ ok: true }),
		}));

		try {
			const form = collect(root, (node) => node.tagName === "FORM")[0];
			for (const fn of form?.listeners.submit ?? []) {
				fn({ preventDefault: () => {} });
			}

			await flush();

			const confirmations = collect(
				root,
				(node) =>
					node.tagName === "P" && node.textContent === CONFIG.confirmation,
			);
			expect(confirmations.length).toBe(1);

			const formsLeft = collect(root, (node) => node.tagName === "FORM");
			expect(formsLeft.length).toBe(0);
		} finally {
			fetchStub.restore();
		}
	});

	test("paints per-field errors on ok:false", async () => {
		const { root } = mountInline();
		const fetchStub = stubFetch(() => ({
			ok: true,
			json: () => ({
				ok: false,
				errors: {
					f1: "That name looks off.",
					_form: "Please fix the errors above.",
				},
			}),
		}));

		try {
			const form = collect(root, (node) => node.tagName === "FORM")[0];
			for (const fn of form?.listeners.submit ?? []) {
				fn({ preventDefault: () => {} });
			}

			await flush();

			const errorTexts = collect(
				root,
				(node) => node.className === "jf-err",
			).map((node) => node.textContent);

			expect(errorTexts).toContain("That name looks off.");
			expect(errorTexts).toContain("Please fix the errors above.");

			const formsLeft = collect(root, (node) => node.tagName === "FORM");
			expect(formsLeft.length).toBe(1);
		} finally {
			fetchStub.restore();
		}
	});

	test("shows a retry-able message when the fetch itself fails", async () => {
		const { root } = mountInline();
		const original = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.reject(new Error("network down"))) as unknown as typeof fetch;

		try {
			const form = collect(root, (node) => node.tagName === "FORM")[0];
			for (const fn of form?.listeners.submit ?? []) {
				fn({ preventDefault: () => {} });
			}

			await flush();

			const errorTexts = collect(
				root,
				(node) => node.className === "jf-err",
			).map((node) => node.textContent);

			expect(errorTexts).toContain("Something went wrong — please try again.");
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("the form embed never throws", () => {
	test("even when the page has no body yet", () => {
		const doc = {
			cookie: "",
			referrer: "",
			location: { pathname: "/", search: "", hostname: "example.com" },
			createElement: (tag: string) => fakeElement(tag),
			querySelector: () => null,
		};

		expect(() =>
			new Function("document", formSource(CONFIG, ENDPOINT))(doc),
		).not.toThrow();
	});

	test("even when the config carries script-ish, quote-laden strings", () => {
		const nasty = "</script><img src=x onerror=alert(1)>\"'`" + "$" + "{}";
		const config: PublicFormConfig = {
			...CONFIG,
			fields: [{ id: "f1", type: "TEXT", label: nasty, required: false }],
		};

		const source = formSource(config, ENDPOINT);

		expect(source).not.toContain("</script>");

		const target = fakeElement("div");
		target.setAttribute("data-janus-form", config.id);
		const doc = fakeDocument({ target });

		expect(() => new Function("document", source)(doc)).not.toThrow();

		const labels = collect(
			target.shadowRoot as FakeNode,
			(node) => node.tagName === "LABEL",
		).map((node) => node.textContent);

		expect(labels).toContain(nasty);
	});
});

describe("the hosted page renders the same fields as the embed", () => {
	test("same labels and required marks, from one fixture config", () => {
		const markup = fieldsMarkup(CONFIG);
		const hostedLabels = [
			...markup.matchAll(/<label[^>]*>(.*?)<\/label>/g),
		].map((match) => match[1]);

		const { root } = mountInline();
		const embedLabels = collect(root, (node) => node.tagName === "LABEL").map(
			(node) => node.textContent,
		);

		expect(hostedLabels).toEqual(embedLabels);
		expect(markup).toContain('name="website_url"');
		expect(markup).toContain('class="jf-hp"');
	});
});
