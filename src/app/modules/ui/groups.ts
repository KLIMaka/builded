import { cyclic } from "ts-utils/mathutils";
import { Consumer, Function, Supplier } from "ts-utils/types";
import { Disconnector, HandleProvider } from "app/apis/app1";
import { Block, GroupsModel, Layout, addClass, clazz, removeClass } from "app/apis/ui";

export class GroupsModelImpl<T> implements GroupsModel<T> {
  private currentLayout: Layout;
  private selectedItem: T;
  private items = new Map<T, Block>();
  private handlers = new HandleProvider<Consumer<T>>();

  constructor(
    private layout: Supplier<Layout>,
    private item: Function<T, Block>,
    private root: Layout
  ) {
    this.newBlock();
    this.root.asWidget().event('wheel', e => {
      const delta = Math.sign(e.deltaY);
      const keys = [...this.items.keys()];
      const idx = keys.indexOf(this.selectedItem);
      if (idx == -1) this.select(keys[0]);
      else this.select(keys[cyclic(idx + delta, keys.length)]);
    });
  }

  addItem(item: T, size = 'auto') {
    const itm = this.item(item);
    this.items.set(item, itm);
    itm.event('click', () => this.select(item));
    this.currentLayout.insert(itm, size);
    return this;
  }

  newBlock() {
    this.currentLayout = this.layout();
    this.root.widget(this.currentLayout);
    return this;
  }

  asWidget(): Block {
    return this.root.asWidget();
  }

  select(item: T): void {
    if (item == this.selectedItem) return;

    if (this.selectedItem != null) {
      const item = this.items.get(this.selectedItem);
      if (item != null) item.mod(clazz.remove('selected'));
    }
    const selectedItem = this.items.get(item);
    if (selectedItem != null) selectedItem.mod(clazz.add('selected'));
    this.selectedItem = item;
    this.handlers.get().forEach(h => h(item));
  }

  selected(): T {
    return this.selectedItem;
  }

  addChangeHandler(handler: (s: T) => void): Disconnector {
    return this.handlers.add(handler);
  }

  clear() {
    this.root.clear();
    this.newBlock();
  }
}