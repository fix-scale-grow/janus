import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadRootEnv } from "@crm/env";
import pg from "pg";
import { decideDeploy } from "./deploy-guard";

const directory = join(import.meta.dir, "..");
const migrationsDirectory = join(directory, "prisma/migrations");

await run([process.execPath, "scripts/require-local-db.ts", "dev"]);

const decision = await planDeploy();

if (decision.action === "skip") console.log(`  ${decision.reason}`);

const migration =
	decision.action === "deploy"
		? await execute([process.execPath, "run", "prisma", "migrate", "deploy"])
		: 0;

if (migration !== 0) process.exit(migration);

const generation = await execute([
	process.execPath,
	"run",
	"prisma",
	"generate",
]);

if (generation !== 0) process.exit(generation);

if (decision.action === "skip") {
	console.log("Generated Prisma client is ready. Migrations were skipped.");
	process.exit(0);
}

const drift = await execute([
	process.execPath,
	"run",
	"prisma",
	"migrate",
	"diff",
	"--from-config-datasource",
	"--to-schema",
	"prisma/schema.prisma",
	"--exit-code",
]);

if (drift === 2) {
	console.error(
		"The database and Prisma schema differ. Reconcile the migration history with `bun run db:migrate` before starting dev.",
	);
	process.exit(1);
}

if (drift !== 0) process.exit(drift);

console.log("Database migrations and generated Prisma client are ready.");

async function run(command: string[]): Promise<void> {
	const exitCode = await execute(command);
	if (exitCode !== 0) process.exit(exitCode);
}

async function execute(command: string[]): Promise<number> {
	const child = Bun.spawn(command, {
		cwd: directory,
		env: process.env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});

	return child.exited;
}

async function planDeploy() {
	loadRootEnv();

	const localNames = readdirSync(migrationsDirectory)
		.filter((name) => statSync(join(migrationsDirectory, name)).isDirectory())
		.sort();

	const allowEnv = process.env.JANUS_ALLOW_DEPLOY === "1";
	const url = process.env.DATABASE_URL;

	if (!url) return decideDeploy(localNames, [], {}, allowEnv);

	const client = new pg.Client({ connectionString: url });
	await client.connect();

	let appliedNames: string[] = [];
	try {
		const result = await client.query<{ migration_name: string }>(
			'SELECT migration_name FROM "_prisma_migrations"',
		);
		appliedNames = result.rows.map((row) => row.migration_name);
	} catch {
		appliedNames = [];
	} finally {
		await client.end();
	}

	const pendingSqlByName: Record<string, string> = {};
	for (const name of localNames) {
		if (appliedNames.includes(name)) continue;
		try {
			pendingSqlByName[name] = readFileSync(
				join(migrationsDirectory, name, "migration.sql"),
				"utf8",
			);
		} catch {
			pendingSqlByName[name] = "";
		}
	}

	return decideDeploy(localNames, appliedNames, pendingSqlByName, allowEnv);
}
