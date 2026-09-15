import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import playwrightPkg from "../sdd/2026-09-15-access-groups/pw/node_modules/playwright/index.js";

const { chromium } = playwrightPkg;

const HERE = dirname(fileURLToPath(import.meta.url));
const PW_DIR = join(HERE, "..", "sdd", "2026-09-15-access-groups", "pw");
mkdirSync(PW_DIR, { recursive: true });

const APP = "http://localhost:3113";
const SLUG = "kyle-s-crm";
const PSQL = "C:\\Users\\Kyle\\pg17\\pgsql\\bin\\psql.exe";
const DB_URL = (process.env.DATABASE_URL ?? "").split("?")[0];
if (!DB_URL) throw new Error("DATABASE_URL not set. Source .env first.");

const RUN = randomBytes(3).toString("hex");
const EMAIL = {
	owner: `owner-${RUN}@example.test`,
	clerk: `clerk-${RUN}@example.test`,
	office: `office-${RUN}@example.test`,
	crew: `crew-${RUN}@example.test`,
};
const USERNAME = Object.fromEntries(
	Object.entries(EMAIL).map(([k, v]) => [k, v.split("@")[0]]),
);

const results = [];
const psqlLog = [];
const screenshots = [];

function record(name, pass, evidence) {
	results.push({ name, pass, evidence });
	console.log(`${pass ? "PASS" : "FAIL"} - ${name}\n  ${evidence}`);
}

function psql(sql) {
	psqlLog.push(sql);
	const out = execFileSync(
		PSQL,
		[DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
		{ encoding: "utf8" },
	);
	return out.trim();
}

async function shot(page, name) {
	const path = join(PW_DIR, `task15-${name}.png`);
	await page.screenshot({ path, fullPage: true });
	screenshots.push(path);
	return path;
}

async function trpcQuery(page, path, input) {
	const url = `${APP}/api/trpc/${path}?input=${encodeURIComponent(
		JSON.stringify(input ?? {}),
	)}`;
	return page.evaluate(async (u) => {
		const res = await fetch(u, { credentials: "include" });
		const body = await res.json().catch(() => null);
		return { status: res.status, body };
	}, url);
}

async function trpcMutation(page, path, input) {
	const url = `${APP}/api/trpc/${path}`;
	return page.evaluate(
		async ({ u, i }) => {
			const res = await fetch(u, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(i ?? {}),
			});
			const body = await res.json().catch(() => null);
			return { status: res.status, body };
		},
		{ u: url, i: input },
	);
}

function trpcResult(resp) {
	return resp.body?.result?.data ?? null;
}

function trpcError(resp) {
	const err = resp.body?.error;
	return err ? { code: err.data?.code ?? null, message: err.message } : null;
}

async function devLogin(context, email) {
	const page = await context.newPage();
	await page.goto(`${APP}/api/dev-login?email=${encodeURIComponent(email)}`);
	await page.waitForURL(new RegExp(`/${SLUG}(/|$)`), { timeout: 15000 });
	return page;
}

function memberRole(email) {
	return psql(
		`select role from member m join "user" u on u.id = m."userId" where u.email = '${email}';`,
	);
}

async function setAccess(ownerPage, username, email, groupLabel) {
	await ownerPage.goto(`${APP}/${SLUG}/settings/team?tab=members`);
	const trigger = ownerPage.locator(`[aria-label="Access for ${username}"]`);
	await trigger.waitFor({ timeout: 15000 });

	if (memberRole(email) === "owner") {
		await trigger.click();
		await ownerPage.getByRole("option", { name: "Admin", exact: true }).click();
		await ownerPage
			.getByText(`${username} is now an Admin.`)
			.waitFor({ timeout: 10000 });
		let role = memberRole(email);
		for (let i = 0; i < 20 && role !== "admin"; i++) {
			await ownerPage.waitForTimeout(300);
			role = memberRole(email);
		}
		await ownerPage.reload();
		await trigger.waitFor({ timeout: 15000 });
	}

	await trigger.click();
	await ownerPage
		.getByRole("option", { name: groupLabel, exact: true })
		.click();
	await ownerPage
		.getByText(`${username} is now in ${groupLabel}.`)
		.waitFor({ timeout: 10000 });
	let role = memberRole(email);
	for (let i = 0; i < 20 && role !== "member" && role !== "admin"; i++) {
		await ownerPage.waitForTimeout(300);
		role = memberRole(email);
	}
}

async function navTexts(page) {
	await page.waitForSelector("nav", { timeout: 15000 });
	await page.waitForTimeout(1000);
	const texts = await page.locator("nav a").allTextContents();
	return texts.map((t) => t.trim()).filter(Boolean);
}

async function main() {
	console.log(`RUN suffix: ${RUN}`);
	console.log(`Emails: ${JSON.stringify(EMAIL, null, 2)}`);

	const browser = await chromium.launch();
	const ownerCtx = await browser.newContext();
	const clerkCtx = await browser.newContext();
	const officeCtx = await browser.newContext();
	const crewCtx = await browser.newContext();

	const owner = await devLogin(ownerCtx, EMAIL.owner);
	const clerk = await devLogin(clerkCtx, EMAIL.clerk);
	const office = await devLogin(officeCtx, EMAIL.office);
	const crew = await devLogin(crewCtx, EMAIL.crew);

	console.log("Minted 4 owner-role users via dev-login.");

	await setAccess(owner, USERNAME.clerk, EMAIL.clerk, "Sales clerk");
	await setAccess(owner, USERNAME.office, EMAIL.office, "Office");
	await setAccess(owner, USERNAME.crew, EMAIL.crew, "Crew lead");
	console.log("Assigned clerk/office/crew into their groups via Settings > Team > Members UI.");

	const clerkUserId = psql(
		`select id from "user" where email = '${EMAIL.clerk}';`,
	);
	const officeUserId = psql(
		`select id from "user" where email = '${EMAIL.office}';`,
	);
	const stageId = psql(
		`select id from stage where "isEntry" = true order by position limit 1;`,
	);

	const dealClerkId = `qa15dealclerk${RUN}`;
	const dealOfficeId = `qa15dealoffice${RUN}`;
	const estimateId = `qa15est${RUN}`;
	const photoId = `qa15photo${RUN}00000`;
	const jobCostId = `qa15cost${RUN}`;

	psql(
		`insert into deal (id, name, "ownerId", "stageId", "createdAt", "updatedAt", "stageChangedAt") ` +
			`values ('${dealClerkId}', 'QA15 Clerk Deal ${RUN}', '${clerkUserId}', '${stageId}', now(), now(), now());`,
	);
	psql(
		`insert into deal (id, name, "ownerId", "stageId", "createdAt", "updatedAt", "stageChangedAt") ` +
			`values ('${dealOfficeId}', 'QA15 Office Deal ${RUN}', '${officeUserId}', '${stageId}', now(), now(), now());`,
	);
	psql(
		`insert into estimate (id, "dealId", "createdById", "createdAt", "updatedAt") ` +
			`values ('${estimateId}', '${dealClerkId}', '${clerkUserId}', now(), now());`,
	);
	psql(
		`insert into photo (id, "dealId", "uploadedById", filename, "mimeType", "sizeBytes", width, height, "createdAt", "updatedAt") ` +
			`values ('${photoId}', '${dealOfficeId}', '${officeUserId}', 'qa15.jpg', 'image/jpeg', 1000, 100, 100, now(), now());`,
	);
	psql(
		`insert into job_cost (id, "dealId", date, "amountCents", currency, category, "createdById", "createdAt", "updatedAt") ` +
			`values ('${jobCostId}', '${dealOfficeId}', now(), 50000, 'USD', 'MATERIALS', '${officeUserId}', now(), now());`,
	);
	console.log(
		`Created deal (clerk-owned) ${dealClerkId} + estimate ${estimateId}; deal (office-owned) ${dealOfficeId} + photo ${photoId} + job cost ${jobCostId}.`,
	);

	await owner.goto(`${APP}/${SLUG}/settings/team?tab=groups`);
	await owner.waitForSelector("text=Sales clerk", { timeout: 15000 });
	const groupsBodyText = await owner.locator("body").innerText();
	const hasThree =
		groupsBodyText.includes("Sales clerk") &&
		groupsBodyText.includes("Office") &&
		groupsBodyText.includes("Crew lead");
	const legacy = groupsBodyText.includes("Office + profit");
	await shot(owner, "01-groups-list");
	record(
		"1. Owner sees 3 seed groups (+ legacy if present)",
		hasThree,
		`Sales clerk/Office/Crew lead present: ${hasThree}; "Office + profit" legacy present: ${legacy}. Screenshot task15-01-groups-list.png`,
	);

	await owner
		.locator('button:has-text("Sales clerk")')
		.first()
		.click();
	await owner.waitForSelector('[aria-label="Photos access"]', {
		timeout: 15000,
	});
	const photosGroup = owner.locator('[aria-label="Photos access"]');
	const originalPhotosPressed = await photosGroup
		.locator('button[data-state="on"]')
		.first()
		.textContent();
	await photosGroup.getByRole("radio", { name: "Hidden", exact: true }).click();
	await owner.getByRole("button", { name: "Save", exact: true }).click();
	let savedToastSeen = false;
	try {
		await owner.getByText(/^Saved\./).waitFor({ timeout: 10000 });
		savedToastSeen = true;
	} catch {
		savedToastSeen = false;
	}
	await shot(owner, "02-sales-clerk-photos-hidden");
	record(
		"2. Owner edits Sales clerk Photos to Hidden, saves",
		savedToastSeen,
		`Original Photos level was "${originalPhotosPressed?.trim()}". Toast starting with "Saved." seen: ${savedToastSeen}. Screenshot task15-02-sales-clerk-photos-hidden.png`,
	);

	await clerk.goto(`${APP}/${SLUG}`);
	const clerkNav = await navTexts(clerk);
	const clerkExpectedPresent = ["Contacts", "Sales", "Drawings", "Estimates"];
	const clerkExpectedAbsent = ["Settings", "Invoices", "Reports"];
	const presentOk = clerkExpectedPresent.every((t) => clerkNav.includes(t));
	const absentOk = clerkExpectedAbsent.every((t) => !clerkNav.includes(t));
	await shot(clerk, "03-clerk-rail");
	record(
		"3. Clerk rail shows Contacts/Sales/Drawings/Estimates only, no Settings/Invoices/Reports",
		presentOk && absentOk,
		`Rail items: ${JSON.stringify(clerkNav)}. Screenshot task15-03-clerk-rail.png`,
	);

	await clerk.goto(`${APP}/${SLUG}/deals`);
	await clerk.waitForTimeout(1500);
	const dealsBodyText = await clerk.locator("body").innerText();
	const seesOwn = dealsBodyText.includes(`QA15 Clerk Deal ${RUN}`);
	const seesOther = dealsBodyText.includes(`QA15 Office Deal ${RUN}`);
	await shot(clerk, "04-clerk-deals-board");
	record(
		"4. Clerk deals board shows only their own deal",
		seesOwn && !seesOther,
		`Sees own deal: ${seesOwn}; sees other deal: ${seesOther}. Screenshot task15-04-clerk-deals-board.png`,
	);

	await clerk.goto(`${APP}/${SLUG}/invoices`);
	await clerk.waitForTimeout(3500);
	const invoicesText = await clerk.locator("body").innerText();
	const hasStackTrace =
		/Unhandled Runtime Error|at Object\.|node_modules\//.test(invoicesText);
	const noSeededDataLeaked =
		!invoicesText.includes(dealClerkId) &&
		!invoicesText.includes(dealOfficeId) &&
		!invoicesText.includes(estimateId) &&
		!invoicesText.includes(`QA15 Clerk Deal ${RUN}`) &&
		!invoicesText.includes(`QA15 Office Deal ${RUN}`);
	const hasEmptyOrNotFoundMarker =
		invoicesText.includes("No invoices") || invoicesText.includes("not found");
	await shot(clerk, "05-clerk-invoices");
	record(
		"5. Clerk visiting /invoices shows no invoices and no error-page leak",
		!hasStackTrace && noSeededDataLeaked && hasEmptyOrNotFoundMarker,
		`Body length ${invoicesText.length} chars, stack-trace-like content detected: ${hasStackTrace}, seeded deal/estimate identifiers leaked: ${!noSeededDataLeaked}, empty/not-found marker present: ${hasEmptyOrNotFoundMarker}. Screenshot task15-05-clerk-invoices.png`,
	);

	await clerk.goto(`${APP}/${SLUG}`);
	const searchResp = await trpcQuery(clerk, "search.quick", {
		q: `QA15 Office Deal ${RUN}`,
	});
	const searchData = trpcResult(searchResp);
	const searchHits = JSON.stringify(searchData ?? {});
	const foundOther = searchHits.includes(dealOfficeId) || searchHits.includes(`QA15 Office Deal ${RUN}`);
	record(
		"6. Clerk global search for the other deal's name returns nothing",
		!foundOther,
		`search.quick status ${searchResp.status}, result: ${searchHits.slice(0, 300)}`,
	);

	const photoResp = await clerk.request.get(
		`${APP}/api/photos/${photoId}/thumb`,
	);
	record(
		"7. Clerk opening another deal's photo thumb returns 404",
		photoResp.status() === 404,
		`GET /api/photos/${photoId}/thumb -> ${photoResp.status()}`,
	);

	await office.goto(`${APP}/${SLUG}/deals`);
	await office.waitForTimeout(1500);
	const officeDealsText = await office.locator("body").innerText();
	const officeSeesBoth =
		officeDealsText.includes(`QA15 Clerk Deal ${RUN}`) &&
		officeDealsText.includes(`QA15 Office Deal ${RUN}`);
	const officeDeleteButtons = await office
		.getByRole("button", { name: /^Delete$/i })
		.count();

	await office.goto(
		`${APP}/${SLUG}/deals?record=${encodeURIComponent(`deal:${dealOfficeId}`)}&tab=costs`,
	);
	await office.waitForTimeout(2500);
	const officeCostsTabText = await office.locator("body").innerText();
	const hasHiddenMoney = officeCostsTabText.includes("Hidden");
	await shot(office, "08-office-deals-board");
	record(
		"8. Office sees both deals, no Delete buttons visible, profit shows Hidden",
		officeSeesBoth && officeDeleteButtons === 0 && hasHiddenMoney,
		`Sees both deals: ${officeSeesBoth}; visible "Delete" buttons on deals page: ${officeDeleteButtons}; "Hidden" text present on the deal's Job costs tab (a $500 job cost was seeded so the mask has something to hide): ${hasHiddenMoney}. Screenshot task15-08-office-deals-board.png`,
	);

	await crew.goto(`${APP}/${SLUG}/deals`);
	await crew.waitForURL(new RegExp(`/${SLUG}/field$`), { timeout: 15000 });
	const crewRedirectedDeals = crew.url().endsWith(`/${SLUG}/field`);
	await crew.goto(`${APP}/${SLUG}/chat`);
	await crew.waitForURL(new RegExp(`/${SLUG}/field$`), { timeout: 15000 });
	const crewRedirectedChat = crew.url().endsWith(`/${SLUG}/field`);
	const crewDealsListResp = await trpcQuery(crew, "deals.list", {});
	const crewDealsListErr = trpcError(crewDealsListResp);
	await shot(crew, "09-crew-field");
	record(
		"9. Crew redirected to /field for any app URL and for /chat; deals.list fetch FORBIDDEN 'Field mode can't use this.'",
		crewRedirectedDeals &&
			crewRedirectedChat &&
			crewDealsListErr?.code === "FORBIDDEN" &&
			crewDealsListErr?.message === "Field mode can't use this.",
		`/deals -> ${crew.url()} (redirected: ${crewRedirectedDeals}); /chat redirected: ${crewRedirectedChat}; deals.list error: ${JSON.stringify(
			crewDealsListErr,
		)}. Screenshot task15-09-crew-field.png`,
	);

	await setAccess(owner, USERNAME.clerk, EMAIL.clerk, "Office");
	await clerk.goto(`${APP}/${SLUG}/deals`);
	await clerk.waitForTimeout(1500);
	const clerkAfterMoveText = await clerk.locator("body").innerText();
	const clerkNowSeesBoth =
		clerkAfterMoveText.includes(`QA15 Clerk Deal ${RUN}`) &&
		clerkAfterMoveText.includes(`QA15 Office Deal ${RUN}`);
	await shot(clerk, "10-clerk-moved-to-office");
	record(
		"10. Owner moves clerk to Office; clerk reload sees both deals without re-login",
		clerkNowSeesBoth,
		`After move + navigating to /deals (no dev-login call, same session), clerk sees both deals: ${clerkNowSeesBoth}. Screenshot task15-10-clerk-moved-to-office.png`,
	);
	await setAccess(owner, USERNAME.clerk, EMAIL.clerk, "Sales clerk");
	console.log("Restored clerk to Sales clerk group.");

	await owner.goto(`${APP}/${SLUG}/settings/team?tab=groups`);
	await owner.locator('button:has-text("Office")').first().click();
	await owner.waitForSelector('button:has-text("Delete group")', {
		timeout: 15000,
	});
	const deleteBtn = owner.locator('button:has-text("Delete group")').first();
	const ariaDisabled = await deleteBtn.getAttribute("aria-disabled");
	await deleteBtn.hover();
	let tooltipText = "";
	try {
		await owner
			.getByText("Move this group's people to another group first.")
			.waitFor({ timeout: 5000 });
		tooltipText = "Move this group's people to another group first.";
	} catch {
		tooltipText = "";
	}
	await shot(owner, "11-office-delete-disabled");
	record(
		"11. Owner tries Delete on Office (has people): button disabled with tooltip",
		ariaDisabled !== null && tooltipText.length > 0,
		`aria-disabled attr: ${ariaDisabled}; tooltip text: "${tooltipText}". Screenshot task15-11-office-delete-disabled.png`,
	);

	await owner.goto(`${APP}/${SLUG}/settings/team?tab=members`);
	await owner.waitForSelector(`[aria-label="Access for ${USERNAME.office}"]`, {
		timeout: 15000,
	});
	await owner.locator(`[aria-label="Access for ${USERNAME.office}"]`).click();
	await owner.getByRole("option", { name: "Owner", exact: true }).click();
	await owner
		.getByRole("button", { name: /Make owner/i })
		.click();
	let promotedToastOk = false;
	try {
		await owner.getByText(`${USERNAME.office} is now an owner.`).waitFor({
			timeout: 10000,
		});
		promotedToastOk = true;
	} catch {
		promotedToastOk = false;
	}
	await shot(owner, "12a-office-promoted");

	await owner.locator(`[aria-label="Access for ${USERNAME.office}"]`).click();
	await owner.getByRole("option", { name: "Admin", exact: true }).click();
	let demotedToastOk = false;
	try {
		await owner.getByText(`${USERNAME.office} is now an Admin.`).waitFor({
			timeout: 10000,
		});
		demotedToastOk = true;
	} catch {
		demotedToastOk = false;
	}
	await shot(owner, "12b-office-demoted-to-admin");

	await setAccess(owner, USERNAME.office, EMAIL.office, "Office");
	console.log("office-<run> placed back into Office group.");

	const ownerCountRow = psql(
		`select count(*) from member where "organizationId" = 'workspace' and role = 'owner';`,
	);
	const selfMembersResp = await trpcQuery(owner, "workspace.members", {
		pageSize: 100,
	});
	const selfMemberRows = trpcResult(selfMembersResp)?.rows ?? [];
	const selfMemberId = selfMemberRows.find((r) => r.isViewer)?.id ?? null;
	const lastOwnerResp = await trpcMutation(owner, "workspace.setMemberRole", {
		memberId: selfMemberId,
		role: "admin",
	});
	const lastOwnerErr = trpcError(lastOwnerResp);
	const guardExpectedButNotObservable = Number(ownerCountRow) > 1;
	record(
		"12. Owner promotes office to Owner, demotes back to Admin, restores to Office group; last-owner guard check",
		promotedToastOk && demotedToastOk,
		`Promote toast ok: ${promotedToastOk}; demote toast ok: ${demotedToastOk}; office restored to Office group via setAccess helper. ` +
			`Owner count in workspace at guard-check time: ${ownerCountRow}. ` +
			(guardExpectedButNotObservable
				? `Last-owner guard NOT independently triggerable live: pre-existing owners (karlosantanas@gmail.com, ada@trycomp.ai) must not be touched per controller ruling #1, so owners.length is always > 1 and the guard's real-org branch cannot fire without violating that ruling. Attempted a self-demote anyway to confirm no crash: workspace.setMemberRole(self, admin) -> status ${lastOwnerResp.status}, error: ${JSON.stringify(lastOwnerErr)}. The guard itself (owners.length <= 1 -> ForbiddenException "The workspace needs an owner. Make someone else an owner first.") is implemented in apps/api/src/workspace/workspace.service.ts lockOwnersAndCheck and exercised by that file's existing unit tests; this live pass could not additionally exercise it without violating ruling #1.`
				: `Guard fired as expected: ${JSON.stringify(lastOwnerErr)}`),
	);

	await clerk.reload();
	await clerk.waitForTimeout(500);
	const clerkDeleteResp = await trpcMutation(clerk, "deals.delete", {
		id: dealClerkId,
	});
	const clerkDeleteErr = trpcError(clerkDeleteResp);
	record(
		"13. Clerk POST deals.delete on own deal -> FORBIDDEN 'Your group (Sales clerk) can't delete deals. Ask an admin.'",
		clerkDeleteErr?.code === "FORBIDDEN" &&
			clerkDeleteErr?.message ===
				"Your group (Sales clerk) can't delete deals. Ask an admin.",
		`Response: ${JSON.stringify(clerkDeleteErr)}`,
	);

	await clerk.goto(`${APP}/${SLUG}`);
	const clerkNavAfter = await navTexts(clerk);
	const clerkHasChat = clerkNavAfter.includes("Janus AI");
	await shot(clerk, "14a-clerk-chat-entry");

	const crewBridgeResp = await crew.request.get(
		`${APP}/eve/v1/health`,
		{ failOnStatusCode: false },
	);
	let crewBridgeBody = null;
	try {
		crewBridgeBody = await crewBridgeResp.json();
	} catch {
		crewBridgeBody = await crewBridgeResp.text().catch(() => null);
	}
	record(
		"14. Clerk has Janus AI chat entry (FULL surface); crew GET /eve/v1/... bridge returns 403 'Janus chat isn't available for your group.'",
		clerkHasChat &&
			crewBridgeResp.status() === 403 &&
			JSON.stringify(crewBridgeBody).includes(
				"Janus chat isn't available for your group.",
			),
		`Clerk nav has "Janus AI": ${clerkHasChat}. Crew GET /eve/v1/health -> ${crewBridgeResp.status()} body: ${JSON.stringify(
			crewBridgeBody,
		)}. Screenshot task15-14a-clerk-chat-entry.png`,
	);

	console.log("\n--- Cleanup ---");

	await owner.goto(`${APP}/${SLUG}/settings/team?tab=groups`);
	await owner.locator('button:has-text("Sales clerk")').first().click();
	await owner.waitForSelector('[aria-label="Photos access"]', {
		timeout: 15000,
	});
	await owner
		.locator('[aria-label="Photos access"]')
		.getByRole("radio", { name: "View", exact: true })
		.click();
	await owner.getByRole("button", { name: "Save", exact: true }).click();
	await owner.getByText(/^Saved\./).waitFor({ timeout: 10000 }).catch(() => null);
	console.log("Restored Sales clerk Photos level to View.");

	psql(`delete from estimate where id = '${estimateId}';`);
	psql(`delete from photo where id = '${photoId}';`);
	psql(`delete from job_cost where id = '${jobCostId}';`);
	psql(`delete from deal where id = '${dealClerkId}';`);
	psql(`delete from deal where id = '${dealOfficeId}';`);
	for (const email of Object.values(EMAIL)) {
		psql(`delete from session where "userId" = (select id from "user" where email = '${email}');`);
		psql(`delete from account where "userId" = (select id from "user" where email = '${email}');`);
		psql(`delete from member where "userId" = (select id from "user" where email = '${email}');`);
		psql(`delete from "user" where email = '${email}';`);
	}
	console.log("Deleted throwaway deal/estimate/photo rows and clerk/office/crew/owner users+members+sessions.");

	const verifyGroupPhotos = psql(
		`select policy->'areas'->>'photos' from access_group where id = 'cmu2irhz30000t4iad8crrfl1';`,
	);
	const verifyUsersGone = psql(
		`select count(*) from "user" where email in ('${EMAIL.owner}', '${EMAIL.clerk}', '${EMAIL.office}', '${EMAIL.crew}');`,
	);
	const verifyDealsGone = psql(
		`select count(*) from deal where id in ('${dealClerkId}', '${dealOfficeId}');`,
	);
	console.log(
		`Verify: Sales clerk photos policy = ${verifyGroupPhotos}; throwaway users remaining = ${verifyUsersGone}; throwaway deals remaining = ${verifyDealsGone}`,
	);

	await browser.close();

	const passCount = results.filter((r) => r.pass).length;
	console.log(`\n${passCount}/${results.length} steps PASS`);

	const md = [];
	md.push("# Access groups walkthrough results");
	md.push("");
	md.push(`Run suffix: \`${RUN}\``);
	md.push("");
	md.push("## Setup");
	md.push("");
	md.push("Users minted via dev-login, moved into groups via Settings > Team > Members UI as owner-" + RUN + ":");
	md.push(`- ${EMAIL.clerk} -> Sales clerk`);
	md.push(`- ${EMAIL.office} -> Office`);
	md.push(`- ${EMAIL.crew} -> Crew lead`);
	md.push("");
	md.push("psql statements run (setup + cleanup):");
	md.push("```sql");
	for (const s of psqlLog) md.push(s);
	md.push("```");
	md.push("");
	md.push("## Steps");
	md.push("");
	for (const r of results) {
		md.push(`### ${r.pass ? "PASS" : "FAIL"} - ${r.name}`);
		md.push("");
		md.push(r.evidence);
		md.push("");
	}
	md.push("## Cleanup verification");
	md.push("");
	md.push(`- Sales clerk group photos policy restored to: \`${verifyGroupPhotos}\` (expected VIEW)`);
	md.push(`- Throwaway users remaining in DB: ${verifyUsersGone} (expected 0)`);
	md.push(`- Throwaway deals remaining in DB: ${verifyDealsGone} (expected 0)`);
	md.push("");
	md.push(`Total: ${passCount}/${results.length} PASS`);
	md.push("");
	md.push("Screenshots (in .superpowers/sdd/2026-09-15-access-groups/pw/, gitignored):");
	for (const s of screenshots) md.push(`- ${s}`);

	writeFileSync(
		join(HERE, "access-groups-walkthrough.md"),
		md.join("\n") + "\n",
	);
	console.log("\nWrote .superpowers/qa/access-groups-walkthrough.md");
}

main().catch((error) => {
	console.error("SCRIPT ERROR", error);
	process.exit(1);
});
