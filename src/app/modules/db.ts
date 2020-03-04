import { Injector } from "../../utils/injector";
import { Storage, Storages } from "../apis/app";

class Db implements Storage {
  private db: Promise<IDBDatabase>;

  constructor(private name: string, version = 1) {
    this.db = this.connect(name, version);
  }

  private connect(name: string, version = 1): Promise<IDBDatabase> {
    return new Promise((ok, error) => {
      const openRequest = indexedDB.open('BuildEd-' + name, version);
      openRequest.onerror = (e) => error(e);
      openRequest.onsuccess = (db) => ok(openRequest.result);
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        db.onerror = (e) => error(e);
        db.createObjectStore(name, { keyPath: 'key' });
      }
    })
  }

  private async request(mode: IDBTransactionMode) {
    const db = await this.db;
    const transaction = db.transaction(this.name, mode);
    return transaction.objectStore(this.name);
  }

  get(key: string) {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readonly')).get(key.toUpperCase());
      request.onsuccess = () => ok(request.result ? request.result.data : null);
      request.onerror = (e) => error(e);
    })
  }

  set(key: string, value: any) {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readwrite')).put({ key: key.toUpperCase(), name: key, data: value });
      request.onsuccess = () => ok();
      request.onerror = (e) => error(e);
    })
  }

  delete(key: string): Promise<void> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readwrite')).delete(key.toUpperCase());
      request.onsuccess = () => ok();
      request.onerror = (e) => error(e);
    })
  }

  clear(): Promise<void> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readwrite')).clear();
      request.onsuccess = () => ok();
      request.onerror = (e) => error(e);
    })
  }

  keys(): Promise<string[]> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readonly')).openCursor();
      const keys: string[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return ok(keys);
        keys.push(<string>cursor.value.name);
        cursor.continue();
      }
      request.onerror = (e) => error(e);
    })
  }
}

export async function StorageDbConstructor(injector: Injector): Promise<Storages> {
  const storages: { [index: string]: Storage } = {}
  return async name => {
    let storage = storages[name];
    if (storage == undefined) {
      storage = new Db(name);
      storages[name] = storage;
    }
    return storage;
  }
}