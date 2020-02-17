import { Dependency, Injector } from "../../utils/injector";
import { span, Table, closeModal } from "../../utils/ui/ui";
import { Storage_ } from "../apis/app";

export const MapName_ = new Dependency<string>('MapName');
export const MapNames_ = new Dependency<string[]>('MapNames');

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    const db = await injector.getInstance(Storage_);
    const mapName = await db.get('mapName');
    if (mapName) return resolve(mapName);
    injector.getInstance(MapNames_).then(maps => {
      const win = document.getElementById('map_select');
      document.getElementById('map_select_close').addEventListener('click', _ => closeModal(win, resolve, null))
      win.classList.remove('hidden');
      const table = new Table();
      table.className("table-striped");
      maps.forEach(map => table.row([span().text(map)]).click(() => {
        db.set('mapName', map);
        closeModal(win, resolve, map);
      }));
      document.getElementById('map_select_content').appendChild(table.elem());
    })
  })
}