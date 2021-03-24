export async function loadBin(fname: string): Promise<ArrayBuffer> {
  return await fetch(fname).then(r => r.ok ? r.arrayBuffer() : null).catch(r => null);
}

export async function loadString(fname: string): Promise<string> {
  const r = await fetch(fname);
  return r.ok ? r.text() : null;
}
