import { Dependency, Injector } from "../../utils/injector";
import { span, Table } from "../../utils/ui/ui";
import { UI, Window } from "../apis/ui";

export const MapName_ = new Dependency<string>('MapName');
export const MapNames_ = new Dependency<string[]>('MapNames');

let selectMapWindow: Window;
async function getWindow(injector: Injector) {
  const ui = await injector.getInstance(UI);
  if (selectMapWindow == null) {
    selectMapWindow = ui.builder.windowBuilder()
      .id('map_select')
      .title('Select Map')
      .closeable(true)
      .size(350, 600)
      .build();
  }
  return selectMapWindow;
}

export function SelectMap(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    const mapNames = await injector.getInstance(MapNames_);
    const win = await getWindow(injector);
    win.onclose = () => resolve(null);
    const table = new Table();
    table.className("table-striped");
    mapNames.forEach(map => table.row([span().text(map)]).click(() => {
      win.hide();
      resolve(map);
    }));
    win.contentElement.appendChild(table.elem());
  })
}