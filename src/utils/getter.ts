export async function loadBin(fname: string): Promise<ArrayBuffer> {
  const r = await fetch(fname);
  return r.ok ? r.arrayBuffer() : null;
}

export async function loadString(fname: string): Promise<string> {
  const r = await fetch(fname);
  return r.ok ? r.text() : null;
}
