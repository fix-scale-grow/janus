import { connection } from "next/server";
import { routePrincipal } from "@/lib/access-route";
import { bridgeEveRequest } from "@/lib/agent-bridge-route";
import { getSession } from "@/lib/session";

async function handler(request: Request): Promise<Response> {
	await connection();

	return bridgeEveRequest(request, {
		user: async () => {
			const session = await getSession();
			return session
				? {
						id: session.user.id,
						email: session.user.email,
						name: session.user.name,
					}
				: null;
		},
		principal: routePrincipal,
		fetch: (url, init) => fetch(url, init),
	});
}

export {
	handler as DELETE,
	handler as GET,
	handler as HEAD,
	handler as OPTIONS,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};
