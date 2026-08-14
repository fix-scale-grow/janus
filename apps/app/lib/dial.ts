/**
 * Turn a stored phone number into a dialable `tel:` / `sms:` href value.
 *
 * Keeps a single leading `+` (country code) and every digit; drops the spaces,
 * dashes, dots and parens humans write numbers with. Deliberately does NOT try
 * to strip trunk-code conventions like the UK `+44 (0)20…` "(0)" — silently
 * removing digits could corrupt a legitimate number, so every stored digit is
 * preserved and the dialer sorts out formatting.
 *
 * Shared by the deal record sheet's "Reach the customer" and Field Mode's
 * one-tap Call so both dial the exact same normalised number.
 */
export function dialHref(phone: string): string {
	const cleaned = phone.replace(/[^\d+]/g, "");
	// Collapse any interior/duplicate `+` to a single leading one.
	return cleaned.startsWith("+")
		? `+${cleaned.slice(1).replace(/\+/g, "")}`
		: cleaned.replace(/\+/g, "");
}

/** The first contact with a usable phone number, or `null`. Contacts arrive
 * ordered (by first name) so this is stable — the one person a one-tap Call or
 * Text should reach on a job. */
export function reachableContact<T extends { phone?: string | null }>(
	contacts: readonly T[],
): T | null {
	return contacts.find((c) => c.phone && c.phone.trim().length > 0) ?? null;
}
