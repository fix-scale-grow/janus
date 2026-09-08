import {
	FORM_DEFAULT_ACCENT,
	FORM_EMBED_MAX_AGE_SECONDS,
	isFormId,
	type PublicFormConfig,
} from "@crm/db/forms";
import { API_URL } from "@/lib/env";
import { formSource } from "@/lib/forms/embed";
import { fieldsMarkup } from "@/lib/forms/hosted-markup";
import { readLogo } from "@/lib/workspace-logo";

const EMPTY_SCRIPT = "/* this form is not available */\n";

const HEX_COLOR_SHAPE = /^#[0-9a-f]{6}$/i;

function safeAccent(value: string | null | undefined): string {
	return value && HEX_COLOR_SHAPE.test(value) ? value : FORM_DEFAULT_ACCENT;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ form: string }> },
): Promise<Response> {
	const { form } = await params;
	const isScript = form.endsWith(".js");
	const formId = isScript ? form.slice(0, -3) : form;

	if (!isFormId(formId)) {
		return isScript ? emptyScript() : notFoundPage();
	}

	const config = await fetchConfig(formId);

	if (isScript) {
		if (!config) return emptyScript();

		const origin = new URL(request.url).origin;
		const source = formSource(config, `${origin}/api/f/s`);

		return new Response(source, {
			headers: {
				"content-type": "application/javascript; charset=utf-8",
				"cache-control": `public, max-age=${FORM_EMBED_MAX_AGE_SECONDS}, s-maxage=${FORM_EMBED_MAX_AGE_SECONDS}`,
				"x-content-type-options": "nosniff",
			},
		});
	}

	if (!config) return notFoundPage();

	return hostedPage(config);
}

async function fetchConfig(formId: string): Promise<PublicFormConfig | null> {
	try {
		const upstream = await fetch(`${API_URL}/api/f/config/${formId}`, {
			headers: { accept: "application/json" },
		});

		if (!upstream.ok) return null;

		const payload = (await upstream.json()) as {
			config: PublicFormConfig | null;
		};

		return payload.config ?? null;
	} catch {
		return null;
	}
}

function emptyScript(): Response {
	return new Response(EMPTY_SCRIPT, {
		headers: {
			"content-type": "application/javascript; charset=utf-8",
			"cache-control": "public, max-age=60, s-maxage=60",
			"x-content-type-options": "nosniff",
		},
	});
}

function notFoundPage(): Response {
	return new Response(
		page(
			"Form unavailable",
			FORM_DEFAULT_ACCENT,
			"<h1>This form isn't available.</h1><p>Check the link and try again.</p>",
		),
		{
			status: 404,
			headers: { "content-type": "text/html; charset=utf-8" },
		},
	);
}

async function hostedPage(config: PublicFormConfig): Promise<Response> {
	const markup = fieldsMarkup(config);
	const accent = safeAccent(config.brandColor);
	const logo = await readLogo();

	const inner = `${
		logo ? `<img src="/api/workspace/logo/file" alt="">` : ""
	}<div data-janus-form="${escapeHtml(config.id)}">${markup}</div><script src="/f/${escapeHtml(config.id)}.js" async></script>`;

	return new Response(page(config.name, accent, inner), {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": `public, max-age=${FORM_EMBED_MAX_AGE_SECONDS}, s-maxage=${FORM_EMBED_MAX_AGE_SECONDS}`,
		},
	});
}

function page(title: string, accent: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f6f4;font-family:system-ui,-apple-system,sans-serif;padding:24px}
.card{width:100%;max-width:420px;background:#fff;border:1px solid #e5e5e2;border-radius:12px;padding:28px;box-shadow:0 8px 32px rgba(0,0,0,.06)}
.card img{max-height:40px;margin-bottom:16px}
.card h1{font-size:18px;margin:0 0 8px}
.card p{font-size:13px;color:#666;margin:0 0 16px}
.card label{display:block;font-size:12px;margin:10px 0 4px}
.card input,.card select,.card textarea{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:14px;font-family:inherit}
.card button{margin-top:14px;width:100%;padding:10px;border:0;border-radius:6px;background:${accent};color:#fff;font-size:14px;cursor:pointer}
.jf-hp{position:absolute;left:-9999px;top:-9999px;width:0;height:0;opacity:0}
.jf-err{color:#c0392b;font-size:12px;margin-top:4px;min-height:14px}
</style>
</head>
<body>
<div class="card">${body}</div>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
