import type { Session, SessionUser } from "@crm/auth";
import type { AccessPrincipal } from "@crm/db/access-policy";
import type { Request } from "express";

export type BaseTrpcContext = {
	req?: Request;
	session: Session | null;
};

export type AuthedTrpcContext = BaseTrpcContext & {
	user: SessionUser;
};

export type AccessTrpcContext = AuthedTrpcContext & {
	access: AccessPrincipal;
};
