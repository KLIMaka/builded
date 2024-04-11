import { chain } from "@utils/collections";
import { Consumer } from "@utils/types";
import { Action } from "app/apis/actions";
import { ActionsList, ActionsWidget, Block, Menu, Ui, Widget } from "app/apis/ui";
import { actionsList } from "./builders";

export class MenuImpl implements Menu, Widget {
  private root: Block;
  private list: ActionsList;
  private menuActions: Action[] = [];
  private closeMenu: Consumer<void>;

  constructor(
    private ui: Ui,
    items: Iterable<ActionsWidget>
  ) {
    this.menuActions = [ui.actionDescriptors().sub('menu').bind('close', async () => this.hide())];
    this.list = actionsList(ui);
    this.list.setHandler(_ => this.hide())
    for (const item of items) this.list.addItem(item);
    this.root = ui.block('menu');
    this.root.append(this.list.asWidget());
  }

  asWidget(): Block {
    return this.root;
  }

  actions(): Iterable<Action> {
    return chain(this.menuActions, this.list.actions());
  }

  show(elem: Block) {
    this.closeMenu = this.ui.showPopup(elem, this.root, this, () => this.onHide());
  }

  private onHide() {
    this.list.clearSelection();
  }

  private hide() {
    this.closeMenu();
  }
}