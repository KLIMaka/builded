export async function loadBin(fname: string): Promise<ArrayBuffer> {
  return await fetch(fname).then(r => r.ok ? r.arrayBuffer() : null).catch(r => null);
}

export async function loadString(fname: string): Promise<string> {
  return await fetch(fname).then(r => {
    if (r.ok) return r.text();
    throw new Error(`Error while loading ${fname}`);
  });
}
