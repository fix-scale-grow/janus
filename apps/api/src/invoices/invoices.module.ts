import { Module } from "@nestjs/common";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	providers: [InvoicesService, InvoicesRouter],
	exports: [InvoicesService],
})
export class InvoicesModule {}
