import { Dependency, Injector } from "../../utils/injector";
import { closeModal, span, Table } from "../../utils/ui/ui";

export const MapName_ = new Dependency<string>('MapName');
export const MapNames_ = new Dependency<string[]>('MapNames');

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    injector.getInstance(MapNames_).then(maps => {
      const win = document.getElementById('map_select');
      document.getElementById('map_select_close').addEventListener('click', _ => closeModal(win, resolve, null))
      win.classList.remove('hidden');
      const table = new Table();
      table.className("table-striped");
      maps.forEach(map => table.row([span().text(map)]).click(() => {
        closeModal(win, resolve, map);
      }));
      document.getElementById('map_select_content').appendChild(table.elem());
    })
  })
}