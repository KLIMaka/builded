import { SerializedFileSystemHandle } from "app/apis/fs";
import { match } from "ts-pattern";

export function fsIcon(type: SerializedFileSystemHandle['type'] | undefined): string {
  return match(type)
    .with('storage', () => 'database')
    .with('dir', () => 'folder-open')
    .with('zip', () => 'file-zipper')
    .with('memory', () => 'memory')
    .with('rff', 'grp', () => 'floppy-disk')
    .with('stack', () => 'folder-open')
    .with('http', () => 'wifi')
    .with(undefined, () => 'question')
    .exhaustive();
}