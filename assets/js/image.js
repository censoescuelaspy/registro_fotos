import { APP_CONFIG } from './config.js';

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen. Use JPG, PNG o WebP.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')),
      type,
      quality
    );
  });
}

export async function sha256(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stampImage(image, width, height, stamp, quality) {
  const footerHeight = Math.max(96, Math.min(260, Math.round(width * 0.115)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height + footerHeight;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, width, height);
  context.fillStyle = '#123f69';
  context.fillRect(0, height, width, footerHeight);
  context.fillStyle = '#ef4b2f';
  context.fillRect(0, height, Math.max(10, Math.round(width * 0.012)), footerHeight);

  const padding = Math.max(22, Math.round(width * 0.025));
  const titleSize = Math.max(18, Math.min(46, Math.round(width * 0.023)));
  const detailSize = Math.max(14, Math.min(34, Math.round(width * 0.017)));
  context.textBaseline = 'top';
  context.fillStyle = '#ffffff';
  context.font = `700 ${titleSize}px Arial, sans-serif`;
  context.fillText(String(stamp.codigoFoto || stamp.recordId || ''), padding, height + padding * 0.52);
  context.fillStyle = '#d9e7f2';
  context.font = `600 ${detailSize}px Arial, sans-serif`;
  const detail = `Escuela ${stamp.codigoEscuela} | B${stamp.bloque} P${stamp.piso} E${stamp.espacio} | ${stamp.codigoElemento}`;
  context.fillText(detail, padding, height + padding * 0.7 + titleSize);
  context.font = `500 ${Math.max(12, Math.round(detailSize * 0.84))}px Arial, sans-serif`;
  context.fillText(
    `${stamp.tipoElementoLabel} | Form. ${stamp.numeroFormulario} | Hoja ${stamp.numeroHoja} | ${stamp.timestampLabel}`,
    padding,
    height + padding * 0.78 + titleSize + detailSize
  );
  return canvasToBlob(canvas, 'image/jpeg', quality).then((blob) => ({ blob, footerHeight }));
}

export async function prepareImage(file, type = 'EVIDENCIA', stamp = null) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Seleccione una imagen valida.');
  }
  if (file.size > APP_CONFIG.maxSourceBytes) {
    throw new Error('La imagen original supera 50 MB. Use la camara normal o reduzca su tamano.');
  }

  const image = await loadImage(file);
  const isPaper = type === 'HOJA_PAPEL';
  const maxDimension = isPaper ? 3200 : 2400;
  const quality = isPaper ? 0.92 : 0.88;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  let blob = file;
  let footerHeight = 0;

  if (stamp) {
    const stamped = await stampImage(image, width, height, stamp, quality);
    blob = stamped.blob;
    footerHeight = stamped.footerHeight;
  } else if (scale < 1 || !['image/jpeg', 'image/webp'].includes(file.type)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  if (blob.size > APP_CONFIG.maxUploadBytes) {
    throw new Error('La imagen procesada supera 15 MB. Reduzca su resolucion e intente nuevamente.');
  }

  return {
    blob,
    width,
    height: height + footerHeight,
    imageHeight: height,
    footerHeight,
    mimeType: blob.type || 'image/jpeg',
    bytes: blob.size,
    sha256: await sha256(blob),
    originalName: file.name || `captura-${Date.now()}.jpg`,
    capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
    stamp
  };
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

export async function captureLocation(options = {}) {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitud: Number(position.coords.latitude.toFixed(7)),
        longitud: Number(position.coords.longitude.toFixed(7)),
        precisionM: Math.round(position.coords.accuracy),
        capturedAt: new Date(position.timestamp).toISOString()
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: options.timeout || 10000, maximumAge: 30000 }
    );
  });
}
