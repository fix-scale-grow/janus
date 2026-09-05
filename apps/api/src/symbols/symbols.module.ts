import { Module } from "@nestjs/common";
import { SymbolsRouter } from "./symbols.router";
import { SymbolsService } from "./symbols.service";

@Module({
	providers: [SymbolsService, SymbolsRouter],
	exports: [SymbolsService],
})
export class SymbolsModule {}
