
export function size(size: number): string {
  if (size < 1024) return `${size} B`;
  else if (size <= 1024 * 1024) return `${(size / 1024).toFixed(2)} kB`;
  else if (size <= 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}