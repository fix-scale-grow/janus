import { Global, Module } from "@nestjs/common";
import { AccessMiddleware } from "./access.middleware";
import { AccessService } from "./access.service";

@Global()
@Module({
	providers: [AccessService, AccessMiddleware],
	exports: [AccessService, AccessMiddleware],
})
export class AccessModule {}
