export const PHOTO_MASTER_MAX_PX = 2560;
export const PHOTO_THUMB_MAX_PX = 400;
const MASTER_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

function scaled(
	image: HTMLImageElement,
	maxPx: number,
): { width: number; height: number } {
	const largest = Math.max(image.naturalWidth, image.naturalHeight);
	const ratio = largest > maxPx ? maxPx / largest : 1;
	return {
		width: Math.max(1, Math.round(image.naturalWidth * ratio)),
		height: Math.max(1, Math.round(image.naturalHeight * ratio)),
	};
}

function encode(
	image: HTMLImageElement,
	maxPx: number,
	quality: number,
): Promise<Blob | null> {
	const { width, height } = scaled(image, maxPx);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return Promise.resolve(null);
	context.drawImage(image, 0, 0, width, height);
	return new Promise((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", quality),
	);
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		image.src = url;
	});
}

export async function processPhotoFile(file: File) {
	const image = await loadImage(file);
	if (!image || image.naturalWidth === 0) return null;
	const master = await encode(image, PHOTO_MASTER_MAX_PX, MASTER_QUALITY);
	const thumb = await encode(image, PHOTO_THUMB_MAX_PX, THUMB_QUALITY);
	if (!master || !thumb) return null;
	const { width, height } = scaled(image, PHOTO_MASTER_MAX_PX);
	return { master, thumb, width, height };
}
