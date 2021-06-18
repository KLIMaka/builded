

export async function loadWasm(name: string): Promise<{ exports: any; memory: ArrayBuffer; }> {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const importObject = { js: { mem: memory } };

  const inst = await WebAssembly.instantiateStreaming(fetch(name), importObject);
  return { exports: inst.instance.exports, memory: memory.buffer };
}