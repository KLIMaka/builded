import { Dependency, Injector } from "../../utils/injector";
import { span, Table } from "../../utils/ui/ui";
import { dbGet, dbSet } from "../../utils/db";

export const MapName_ = new Dependency<string>('MapName');
export const MapNames_ = new Dependency<string[]>('MapNames');

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    const mapName = await dbGet('mapName');
    if (mapName) return resolve(mapName);
    injector.getInstance(MapNames_).then(maps => {
      const win = document.getElementById('map_select');
      document.getElementById('map_select_close').addEventListener('click', _ => { win.classList.add('hidden'); resolve(null) })
      win.classList.remove('hidden');
      const table = new Table();
      table.className("table-striped");
      maps.forEach(map => table.row([span().text(map)]).click(() => {
        win.classList.add('hidden');
        dbSet('mapName', map);
        resolve(map)
      }));
      document.getElementById('map_select_content').appendChild(table.elem());
    })
  })
}