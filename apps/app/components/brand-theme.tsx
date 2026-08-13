import { brandThemeCss } from "@crm/ui/lib/brand-theme";

/**
 * Injects this instance's brand accent as CSS-variable overrides, layered on top
 * of the base tokens in globals.css. Renders nothing when no valid brand color is
 * configured, so the app falls back to the default Janus theme.
 *
 * Source of the brand color today: the `JANUS_BRAND_COLOR` env var (instance-per-
 * business — each deploy is one org). Follow-up once the settings schema lands:
 * pass `organization.brandColor` here instead, which takes precedence over env.
 */
export function BrandTheme({ brandColor }: { brandColor?: string | null }) {
	const css = brandThemeCss(brandColor ?? process.env.JANUS_BRAND_COLOR);
	if (!css) return null;
	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: static, validated token CSS
		<style id="janus-brand-theme" dangerouslySetInnerHTML={{ __html: css }} />
	);
}
