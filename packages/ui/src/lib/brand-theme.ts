/**
 * Janus brand theming — instance-per-business runtime token overrides.
 *
 * Each Janus instance is single-tenant (one business per deploy), so the brand
 * accent is a per-instance value: an env var today (`JANUS_BRAND_COLOR`) and an
 * org row (`organization.brandColor`) once the settings schema lands. This module
 * turns that one hex value into the small set of CSS custom-property overrides that
 * re-skin the whole app, layered on top of the base tokens in `styles/globals.css`.
 *
 * Pure + dependency-free on purpose: it is unit-testable with `bun test` without a
 * toolchain/DB, and reusable by the app shell AND the agent-built landing pages.
 */

/** The accent tokens re-pointed from a single brand color. */
export const BRAND_TOKEN_VARS = [
	"--primary",
	"--primary-foreground",
	"--ring",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-ring",
] as const;

/**
 * Normalize a user-supplied color to a 6-digit lowercase `#rrggbb` string.
 * Accepts `#rgb`, `rgb`, `#rrggbb`, `rrggbb` (with/without leading `#`, any case).
 * Returns null for anything that is not a valid hex color.
 */
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

/**
 * Relative luminance (WCAG 2.1) of a normalized `#rrggbb` color, 0 (black)–1 (white).
 */
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

/**
 * Pick a readable foreground (near-black or white) for text/icons sitting on top
 * of the given brand color. Uses the same near-black/white as the base token set
 * so contrast stays consistent with the rest of the theme.
 */
export function readableForeground(hex: string): "#171717" | "#ffffff" {
	return relativeLuminance(hex) > 0.5 ? "#171717" : "#ffffff";
}

export interface BrandThemeOptions {
	/** CSS selector the overrides are scoped to. Defaults to `:root`. */
	selector?: string;
}

/**
 * Build the CSS override block that re-skins the app to a single brand color.
 *
 * Returns an empty string when no valid color is supplied — callers render
 * nothing and the base `globals.css` tokens apply unchanged (safe default).
 */
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
	return `${selector}{${decls};}`;
}
