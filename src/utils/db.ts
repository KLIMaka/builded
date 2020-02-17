import { openDB } from '../libs_js/idb/index';

const DB = openDB('keyval-store', 1, { upgrade(db) { db.createObjectStore('keyval') } });


export async function dbGet(key: string) {
  return (await DB).get('keyval', key);
}

export async function dbSet(key: string, val: any) {
  return (await DB).put('keyval', val, key);
}

export async function dbDelete(key: string) {
  return (await DB).delete('keyval', key);
}

export async function dbClear() {
  return (await DB).clear('keyval');
}

export async function dbKeys() {
  return (await DB).getAllKeys('keyval');
}