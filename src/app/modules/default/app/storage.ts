import { toValuesMap, Value, ValuesContainer, ValuesMap } from "@utils/callbacks";
import Optional from "optional-js";
import { Storage, Storages } from "../../../../app/apis/app1";
import { getOrCreate } from "../../../../utils/collections";
import { applyDefaults } from "@utils/objects";
import { debounced } from "@utils/time";

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
    return this.db.then(db => db.transaction(this.name, mode).objectStore(this.name))
  }

  get<T>(key: string): Promise<Optional<T>> {
    return new Promise<Optional<T>>(async (ok, error) => {
      const request = await this.request('readonly').then(r => r.get(key.toUpperCase()));
      request.onsuccess = () => ok(Optional.ofNullable(request.result).map(r => r.data));
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

  getAll<T>(): Promise<T[]> {
    return new Promise(async (ok, error) => {
      const request = (await this.request('readonly')).openCursor();
      const values: T[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return ok(values);
        values.push(cursor.value.data);
        cursor.continue();
      }
      request.onerror = e => error(e);
    })
  }

  async dispose(): Promise<void> {
    return this.db.then(db => db.close());
  }
}

export function DefaultStorages(appName: string): Storages {
  const storages = new Map<string, Storage>();
  return async (name: string) => {
    return getOrCreate(storages, name, _ => new StorageImpl(`${appName}.${name}`));
  }
}

export async function storageValue<T>(values: ValuesContainer, storage: Storage, name: string, def: T): Promise<Value<T>> {
  const initValue = (await storage.get(name)).orElse(def) as T;
  const value = values.value(name, initValue);
  values.handleStandalone([value], v => storage.set(name, v))
  return value;
}

export async function createSavedState<T>(values: ValuesContainer, storage: Storage, id: string, def: T, debounce = 1000): Promise<ValuesMap<T>> {
  let disposed = false;
  const save = debounced(() => { if (!disposed) storage.set(id, state.getObject()) }, debounce);
  const loadedState = await storage.get<T>(id);
  const initialState = loadedState.map(s => applyDefaults(s, def)).orElse(def);
  const state = toValuesMap(initialState, values);
  state.handle(values, save);
  values.addDisconnector(() => disposed = true);
  return state;
}