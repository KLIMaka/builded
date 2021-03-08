import { fit, Raster, Rasterizer, rect } from "./pixelprovider";

export function createEmptyCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createCanvas<P>(raster: Raster<P>, rasterizer: Rasterizer<P>): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  drawToCanvas(raster, canvas.getContext('2d'), rasterizer, 0, 0);
  return canvas;
}

export function drawToCanvas<P>(raster: Raster<P>, ctx: CanvasRenderingContext2D, rasterizer: Rasterizer<P>, x: number = 0, y: number = 0) {
  const data = new Uint8ClampedArray(raster.width * raster.height * 4);
  const id = new ImageData(data, raster.width, raster.height);
  rasterizer(raster, data);
  ctx.putImageData(id, x, y);
}

export function clearCanvas(canvas: HTMLCanvasElement, style: string) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function loadImageFromBuffer(buff: ArrayBuffer): Promise<[number, number, Uint8Array]> {
  return new Promise(resolve => {
    const blob = new Blob([buff]);
    const urlCreator = window.URL;
    const imageUrl = urlCreator.createObjectURL(blob);
    const img = new Image();
    img.src = imageUrl;
    img.onload = (evt) => {
      const img = <HTMLImageElement>evt.target;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = new Uint8Array(ctx.getImageData(0, 0, img.width, img.height).data);
      resolve([img.width, img.height, data]);
    }
  });
}

export function loadImage(name: string): Promise<[number, number, Uint8Array]> {
  return new Promise(resolve => {
    const image = new Image();
    image.src = name;
    image.onload = (evt) => {
      const img = <HTMLImageElement>evt.target;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve([img.width, img.height, new Uint8Array(ctx.getImageData(0, 0, img.width, img.height).data)]);
    }
  });
}
