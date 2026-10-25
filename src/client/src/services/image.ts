
const MAX_SIDE = 800;


const MAX_RAW_BYTES = 3_000_000;

export async function fileToResizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen (usa JPG, PNG o WEBP).');
  }
  if (file.size > MAX_RAW_BYTES * 4) {
    throw new Error('La imagen es demasiado grande (máx. 12 MB).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const accepted = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    if (accepted && scale === 1 && file.size <= MAX_RAW_BYTES) {
      return await readAsDataUrl(file);
    }
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await readAsDataUrl(file);
    ctx.drawImage(img, 0, 0, width, height);


    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, 0.85);
    if (dataUrl.length > MAX_RAW_BYTES) {
      throw new Error('La imagen es demasiado grande; elige otra con menos peso.');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}
