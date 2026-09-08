export const BRAND_TOKEN_VARS = [
	"--primary",
	"--primary-foreground",
	"--ring",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-ring",
] as const;

export function normalizeHex(input?: string | null): string | null {
	if (!input) return null;
	const raw = input.trim().replace(/^#/, "").toLowerCase();
	if (/^[0-9a-f]{3}$/.test(raw)) {
		const [r, g, b] = raw;
		return `#${r}${r}${g}${g}${b}${b}`;
	}
	if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
	return null;
}

export function relativeLuminance(hex: string): number {
	const channel = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function readableForeground(hex: string): "#171717" | "#ffffff" {
	return relativeLuminance(hex) > 0.5 ? "#171717" : "#ffffff";
}

export interface BrandThemeOptions {
	selector?: string;
}

export function brandThemeCss(
	brandColor?: string | null,
	options: BrandThemeOptions = {},
): string {
	const hex = normalizeHex(brandColor);
	if (!hex) return "";
	const selector = options.selector ?? ":root";
	const fg = readableForeground(hex);
	const decls = [
		`--primary:${hex}`,
		`--primary-foreground:${fg}`,
		`--ring:${hex}`,
		`--sidebar-primary:${hex}`,
		`--sidebar-primary-foreground:${fg}`,
		`--sidebar-ring:${hex}`,
	].join(";");
	const ring = `oklch(from ${hex} calc(l + 0.18) c h)`;
	const darkDecls = [`--ring:${ring}`, `--sidebar-ring:${ring}`].join(";");
	const darkSelector =
		selector === ":root" ? ".dark" : `.dark ${selector}, ${selector}.dark`;
	return `${selector}{${decls};}${darkSelector}{${darkDecls};}`;
}
