import { Dependency, getInstances, lifecycle } from "../../utils/injector";
import { replaceContent, span, Table } from "../../utils/ui/ui";
import { UI } from "../apis/ui";

export const MAP_NAMES = new Dependency<() => Promise<string[]>>('MapNames');
export const MAP_SELECTOR = new Dependency<() => Promise<string>>('MapSelector');

export const DefaultMapSelector = lifecycle(async (injector, lifecycle) => {
  const [mapNamesProvider, ui] = await getInstances(injector, MAP_NAMES, UI);
  const selectMapWindow = ui.createWindow('map-seelector', 350, 600);
  selectMapWindow.headerElement.innerText = 'Select Map';
  selectMapWindow.contentElement.style.padding = '10px';

  lifecycle(selectMapWindow, async s => s.destroy());
  const selector = () => new Promise(async (resolve: (s: string) => void) => {
    selectMapWindow.onclose = () => resolve(null);
    const table = new Table('1fr 100px');
    table.head(span().text('Name'), span().text('Date'));
    const mapNames = await mapNamesProvider();
    mapNames.forEach(map => table.row(span().text(map), span().text('2023-04-11')).click(() => { selectMapWindow.hide(); resolve(map); }));
    replaceContent(selectMapWindow.contentElement, table.elem());
    selectMapWindow.show();
  });
  return selector;
});