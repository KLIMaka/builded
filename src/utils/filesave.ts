
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
  };
}());