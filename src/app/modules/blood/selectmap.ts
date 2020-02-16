import { Table, span } from "../../../utils/ui/ui";
import { Injector, Dependency } from "../../../utils/injector";
import { RFF_ } from "./filesystem";

export const MapName_ = new Dependency<string>('MapName');

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(resolve => {
    injector.getInstance(RFF_).then(rff => {
      const win = document.getElementById('map_select');
      document.getElementById('map_select_close').addEventListener('click', _ => { win.classList.add('hidden'); resolve(null) })
      win.classList.remove('hidden');
      const table = new Table();
      table.className("table-striped");
      rff.fat
        .filter(r => r.filename.endsWith('.map'))
        .map(r => r.filename)
        .forEach(map => table.row([span().text(map)]).click(() => {
          win.classList.add('hidden');
          resolve(map)
        }));
      document.getElementById('map_select_content').appendChild(table.elem());
    })
  })
}