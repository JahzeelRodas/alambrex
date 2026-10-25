import path from 'node:path';


export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');


export const CAR_IMAGES_DIRNAME = 'cars';

export function carImagesDir(): string {
  return path.join(UPLOADS_DIR, CAR_IMAGES_DIRNAME);
}
