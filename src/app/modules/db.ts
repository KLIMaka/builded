import { IDBPDatabase, openDB } from "../../libs_js/idb/index";
import { Injector } from "../../utils/injector";
import { Storage, Storages } from "../apis/app";

class StorageDb implements Storage {
  private db: Promise<IDBPDatabase>

  constructor(private name: string) {
    this.db = openDB('keyval-store', 1, { upgrade(db) { db.createObjectStore(name) } });
  }

  async get(key: string) { return (await this.db).get(this.name, key) }
  async set(key: string, value: any) { return (await this.db).put(this.name, value, key) }
  async delete(key: string) { return (await this.db).delete(this.name, key) }
  async clear() { return (await this.db).clear(this.name) }

  async keys(): Promise<string[]> {
    // return (await this.db).getAllKeys('keyval');
    return null;
  }
}

export async function StorageDbConstructor(injector: Injector): Promise<Storages> {
  const storages: { [index: string]: Storage } = {}
  return async name => {
    let storage = storages[name];
    if (storage == undefined) {
      storage = new StorageDb(name);
      storages[name] = storage;
    }
    return storage;
  }
}