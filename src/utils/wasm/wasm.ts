

export async function loadWasm(name: string): Promise<WebAssembly.Exports> {
  const inst = await WebAssembly.instantiateStreaming(fetch(name), {});
  return inst.instance.exports;
}