import { Storage, Storages } from "../../../../app/apis/app1";
import { getOrCreate } from "../../../../utils/collections";
import Optional from "optional-js";

class StorageImpl implements Storage {
  private db: Promise<IDBDatabase>;

  constructor(private name: string, version = 1) {
    this.db = this.connect(name, version);
  }

  private connect(name: string, version = 1): Promise<IDBDatabase> {
    return new Promise((ok, error) => {
      const openRequest = indexedDB.open(name, version);
      openRequest.onerror = e => error(e);
      openRequest.onsuccess = db => ok(openRequest.result);
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        db.onerror = e => error(e);
        db.createObjectStore(name, { keyPath: 'key' });
      }
    })
  }

  private async request(mode: IDBTransactionMode) {
    const db = await this.db;
    const transaction = db.transaction(this.name, mode);
    return transaction.objectStore(this.name);
  }

  get<T>(key: string): Promise<Optional<T>> {
    return new Promise<Optional<T>>(async (ok, error) => {
      const request = (await this.request('readonly')).get(key.toUpperCase());
      request.onsuccess = () => ok(request.result ? Optional.of(request.result.data) : Optional.empty());
      request.onerror = e => error(e);
    })
  }

  set<T>(key: string, value: T) {
    return new Promise<void>(async (ok, error) => {
      const request = (await this.request('readwrite')).put({ key: key.toUpperCase(), name: key, data: value });
      request.onsuccess = () => ok();
      request.onerror = e => error(e);
    })
  }

  delete(key: string): Promise<void> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readwrite')).delete(key.toUpperCase());
      request.onsuccess = () => ok();
      request.onerror = e => error(e);
    })
  }

  clear(): Promise<void> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readwrite')).clear();
      request.onsuccess = () => ok();
      request.onerror = e => error(e);
    })
  }

  keys(): Promise<string[]> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readonly')).openCursor();
      const keys: string[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return ok(keys);
        keys.push(cursor.value.name);
        cursor.continue();
      }
      request.onerror = e => error(e);
    })
  }
}

export function DefaultStorages(appName: string): Storages {
  const storages: Map<string, Storage> = new Map();
  return async (name: string) => {
    return getOrCreate(storages, name, _ => new StorageImpl(`${appName}.${name}`));
  }
}