import type { NextRequest } from "next/server";
import { API_URL } from "@/lib/env";

export const ONBOARDING_PATH = "/onboarding";

export const RESEARCH_PATH = "/onboarding/research";

const GATE_TIMEOUT_MS = 2_000;

export type Gate = "settled" | "required" | "unknown";

async function read<T>(
	request: NextRequest,
	procedure: string,
): Promise<T | null> {
	const cookie = request.headers.get("cookie");

	if (!cookie) return null;

	try {
		const response = await fetch(`${API_URL}/api/trpc/${procedure}`, {
			headers: { cookie },
			cache: "no-store",
			signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
		});

		if (!response.ok) return null;

		const body = (await response.json()) as { result?: { data?: T } };

		return body.result?.data ?? null;
	} catch {
		return null;
	}
}

type GateResult = {
	onboarded?: boolean;
	canRename?: boolean;
	slug?: string;
	researchConfigured?: boolean;
	surface?: "FULL" | "FIELD";
	isAdmin?: boolean;
};

const gateCache = new WeakMap<NextRequest, Promise<GateResult | null>>();

function readGate(request: NextRequest): Promise<GateResult | null> {
	const cached = gateCache.get(request);

	if (cached) return cached;

	const promise = read<GateResult>(request, "workspace.gate");

	gateCache.set(request, promise);

	return promise;
}

export type WorkspaceGate = { gate: Gate; slug: string | null };

export async function readWorkspaceGate(
	request: NextRequest,
): Promise<WorkspaceGate> {
	const gate = await readGate(request);

	const slug = gate?.slug ? gate.slug : null;

	if (typeof gate?.onboarded !== "boolean") {
		return { gate: "unknown", slug };
	}

	return {
		gate: gate.onboarded || !gate.canRename ? "settled" : "required",
		slug,
	};
}

export async function readResearchGate(request: NextRequest): Promise<Gate> {
	const gate = await readGate(request);

	if (typeof gate?.researchConfigured !== "boolean") return "unknown";

	return gate.researchConfigured ? "settled" : "required";
}

export type AccessGate = {
	surface: "FULL" | "FIELD" | null;
	isAdmin: boolean;
};

export async function readAccessGate(
	request: NextRequest,
): Promise<AccessGate> {
	const gate = await readGate(request);

	if (!gate || typeof gate.isAdmin !== "boolean" || !gate.surface) {
		return { surface: null, isAdmin: false };
	}

	return { surface: gate.surface, isAdmin: gate.isAdmin };
}
