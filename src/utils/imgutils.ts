import { PixelProvider, BlendFunc, BlendNormal } from "./pixelprovider";

export function createEmptyCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createCanvas(provider: PixelProvider, blend: BlendFunc = BlendNormal): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = provider.getWidth();
  canvas.height = provider.getHeight();
  drawToCanvas(provider, canvas, 0, 0, blend);
  return canvas;
}

export function drawToCanvas(provider: PixelProvider, canvas: HTMLCanvasElement, x: number = 0, y: number = 0, blend: BlendFunc = BlendNormal) {
  const ctx = canvas.getContext('2d');
  let data: Uint8ClampedArray;
  let id: ImageData;
  if (blend === BlendNormal) {
    data = new Uint8ClampedArray(provider.getWidth() * provider.getHeight() * 4);
    id = new ImageData(data, provider.getWidth(), provider.getHeight());
  } else {
    id = ctx.getImageData(x, y, provider.getWidth(), provider.getHeight());
    data = id.data;
  }
  provider.render(data, blend);
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
