const cache: { [index: string]: any } = {};
const xhrCache: { [index: string]: XMLHttpRequest } = {}
const cacheString: { [index: string]: any } = {};
const xhrCacheString: { [index: string]: XMLHttpRequest } = {}

function getRequest(fname: string, type: XMLHttpRequestResponseType, cache: { [index: string]: XMLHttpRequest }) {
  let xhr = cache[fname];
  if (xhr == undefined) {
    xhr = new XMLHttpRequest();
    xhr.responseType = type;
    xhr.addEventListener('load', () => delete cache[fname]);
    xhr.open('GET', fname, true);
    xhr.send();
    cache[fname] = xhr;
  }
  return xhr;
}

export function loadBin(fname: string, progressCallback: (percent: number) => void = () => { }): Promise<ArrayBuffer> {
  const file = cache[fname];
  if (file != undefined) return Promise.resolve(file);
  return new Promise((resolve) => {
    const xhr = getRequest(fname, 'arraybuffer', xhrCache);
    xhr.addEventListener('load', () => { cache[fname] = xhr.response; resolve(xhr.response) });
    xhr.addEventListener('progress', (e) => { progressCallback(e.loaded / e.total); });
  });
}

export function loadString(fname: string): Promise<string> {
  const str = cacheString[fname];
  if (str != undefined) return Promise.resolve(str);
  return new Promise((resolve) => {
    const xhr = getRequest(fname, 'text', xhrCacheString);
    xhr.addEventListener('load', () => { cacheString[fname] = xhr.response; resolve(xhr.response); });
  })
}
