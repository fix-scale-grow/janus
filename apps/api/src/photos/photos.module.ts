import { Module } from "@nestjs/common";
import { PhotosRouter } from "./photos.router";
import { PhotosService } from "./photos.service";

@Module({
	providers: [PhotosService, PhotosRouter],
	exports: [PhotosService],
})
export class PhotosModule {}
