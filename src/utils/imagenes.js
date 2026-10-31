/**
 * Lee una imagen subida por el usuario y la reduce para guardarla dentro de los datos de empresa.
 * Una foto del móvil puede ocupar varios MB y superar el límite de 4 MB por registro de Supabase,
 * con lo que no se guardaría nada. Logos y firmas no necesitan más de ~800 px.
 */
export function comprimirImagen(file, { maxLado = 800, calidad = 0.85 } = {}) {
  const leer = () => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  return leer().then((dataUrl) => {
    // SVG y GIF se dejan tal cual (vectorial / animado); suelen ser pequeños.
    if (/^data:image\/(svg|gif)/i.test(dataUrl)) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        // PNG conserva la transparencia (firmas, sellos); el resto pasa a JPEG, más ligero.
        const png = /^data:image\/png/i.test(dataUrl);
        const salida = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', calidad);
        resolve(salida.length < dataUrl.length ? salida : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  });
}
