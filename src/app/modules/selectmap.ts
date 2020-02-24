import { Dependency, Injector } from "../../utils/injector";
import { span, Table } from "../../utils/ui/ui";
import { UI, Window } from "../apis/ui";

export const MAP_NAMES = new Dependency<() => Promise<string[]>>('MapNames');

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

export function showMapSelection(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    const mapNamesProvider = await injector.getInstance(MAP_NAMES);
    const mapNames = await mapNamesProvider();
    const win = await getWindow(injector);
    win.onclose = () => resolve(null);
    const table = new Table();
    table.className("table-striped");
    mapNames.forEach(map => table.row([span().text(map)]).click(() => {
      win.hide();
      resolve(map);
    }));
    const lastTable = win.contentElement.firstChild;
    if (lastTable) win.contentElement.removeChild(lastTable);
    win.contentElement.appendChild(table.elem());
    win.show();
  })
}