import { Dependency, getInstances, lifecycle } from "../../utils/injector";
import { replaceContent, span, Table } from "../../utils/ui/ui";
import { UI } from "../apis/ui";

export const MAP_NAMES = new Dependency<() => Promise<string[]>>('MapNames');
export const MAP_SELECTOR = new Dependency<() => Promise<string>>('MapSelector');

export const DefaultMapSelector = lifecycle(async (injector, lifecycle) => {
  const [mapNamesProvider, ui] = await getInstances(injector, MAP_NAMES, UI);
  const selectMapWindow = ui.builder.window()
    .title('Select Map')
    .draggable(true)
    .closeable(true)
    .size(350, 600)
    .build();
  selectMapWindow.hide();
  lifecycle(selectMapWindow, async s => s.destroy());
  const selector = () => new Promise(async (resolve: (s: string) => void) => {
    selectMapWindow.onclose = () => resolve(null);
    const table = new Table();
    table.className("table-striped");
    const mapNames = await mapNamesProvider();
    mapNames.forEach(map => table.row([span().text(map)]).click(() => { selectMapWindow.hide(); resolve(map); }));
    replaceContent(selectMapWindow.contentElement, table.elem());
    selectMapWindow.show();
  });
  return selector;
});