import { Injector } from "../../utils/injector";
import { Storage, Storage_ } from "../apis/app";
import { openDB } from "../../libs_js/idb/index";

class StorageDb implements Storage {
  private db = openDB('keyval-store', 1, { upgrade(db) { db.createObjectStore('keyval') } });

  async get(key: string): Promise<any> {
    return (await this.db).get('keyval', key);
  }

  async  set(key: string, value: any): Promise<any> {
    return (await this.db).put('keyval', value, key);
  }

  async delete(key: string): Promise<any> {
    return (await this.db).delete('keyval', key);
  }

  async clear(): Promise<any> {
    return (await this.db).clear('keyval');
  }

  async keys(): Promise<string[]> {
    // return (await this.db).getAllKeys('keyval');
    return null;
  }
}

export async function DbModule(injector: Injector) {
  const db = new StorageDb();
  injector.bindInstance(Storage_, db);
}