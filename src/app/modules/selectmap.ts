import { Dependency, Injector } from "../../utils/injector";
import { span, Table } from "../../utils/ui/ui";

export const MapName_ = new Dependency<string>('MapName');
export const MapNames_ = new Dependency<string[]>('MapNames');

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(resolve => {
    injector.getInstance(MapNames_).then(maps => {
      const win = document.getElementById('map_select');
      document.getElementById('map_select_close').addEventListener('click', _ => { win.classList.add('hidden'); resolve(null) })
      win.classList.remove('hidden');
      const table = new Table();
      table.className("table-striped");
      maps.forEach(map => table.row([span().text(map)]).click(() => {
        win.classList.add('hidden');
        resolve(map)
      }));
      document.getElementById('map_select_content').appendChild(table.elem());
    })
  })
}