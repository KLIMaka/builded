
export const save = (function () {
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style.display = 'none';
  return function (buffer: ArrayBuffer, fileName: string) {
    const url = window.URL.createObjectURL(new Blob([buffer], { type: "octet/stream" }));
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
}());

export async function saveAs(buffer: ArrayBuffer, fileName: string) {
  const opts = {
    type: 'save-file',
    accepts: [{
      description: 'BUILD Map',
      extensions: ['map'],
    }],
  };
  const handle = await window['chooseFileSystemEntries'](opts);
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}