import { describe, expect, it } from "bun:test";
import { buildCsv } from "./csv";

const COLUMNS = [
	{ key: "name", label: "Name" },
	{ key: "amount", label: "Amount" },
];

describe("buildCsv", () => {
	it("prefixes the file with a UTF-8 BOM", () => {
		const csv = buildCsv(COLUMNS, []);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});

	it("joins header and rows with CRLF", () => {
		const csv = buildCsv(COLUMNS, [{ name: "Acme", amount: 100 }]);
		expect(csv).toBe("﻿Name,Amount\r\nAcme,100");
	});

	it("quotes a field containing a comma", () => {
		const csv = buildCsv(COLUMNS, [{ name: "Acme, Inc.", amount: 1 }]);
		expect(csv).toBe('﻿Name,Amount\r\n"Acme, Inc.",1');
	});

	it("doubles an embedded quote and wraps the field in quotes", () => {
		const csv = buildCsv(COLUMNS, [{ name: 'Bob "The Builder"', amount: 1 }]);
		expect(csv).toBe('﻿Name,Amount\r\n"Bob ""The Builder""",1');
	});

	it("quotes a field containing a newline", () => {
		const csv = buildCsv(COLUMNS, [{ name: "Acme\nHQ", amount: 1 }]);
		expect(csv).toBe('﻿Name,Amount\r\n"Acme\nHQ",1');
	});

	it("renders a null cell as an empty string, unquoted", () => {
		const csv = buildCsv(COLUMNS, [{ name: "Acme", amount: null }]);
		expect(csv).toBe("﻿Name,Amount\r\nAcme,");
	});

	it("leaves a plain field unquoted", () => {
		const csv = buildCsv(COLUMNS, [{ name: "Acme", amount: 100 }]);
		expect(csv).not.toContain('"Acme"');
	});
});
