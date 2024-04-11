import { Deck, chain } from "@utils/collections";
import { clamp } from "@utils/mathutils";
import { Consumer } from "@utils/types";
import { AutoScroller } from "@utils/ui/ui";
import { Action, ActionDescriptors, } from "app/apis/actions";
import { ActionsList, ActionsWidget, Block, Ui, clazz } from "app/apis/ui";

type ActionItemRecord = { item: ActionsWidget, block: Block };
export class ActionsListImpl implements ActionsList {
  private root: Block;
  private aList: Action[] = [];
  private current = -1;
  private itemsIndex = new Map<HTMLElement, number>();
  private itemsList: ActionItemRecord[] = [];
  private handler: Consumer<ActionsWidget>;
  private autoScroller: AutoScroller;

  constructor(private ui: Ui) {
    this.root = ui.block('actions-list');
    this.aList = this.createActions(ui.actionDescriptors().sub('list'));
    this.autoScroller = new AutoScroller(this.root.cast());
  }

  clear(): void {
    this.itemsIndex.clear();
    this.itemsList = [];
    this.current = -1;
    this.root.replace();
  }

  addItem(item: ActionsWidget, selected = false) {
    const block = this.ui.block('action-list-item').append(item.asWidget());
    if (selected) block.mod(clazz.add('selected'));
    if (item.defaultAction.isPresent()) {
      const idx = this.itemsList.length;
      block
        .event('mouseenter', _ => this.select(idx))
        .event('mouseleave', _ => this.clearSelection())
        .event('click', _ => this.action(idx));

      this.itemsList.push({ block, item })
      this.itemsIndex.set(block.cast(), idx);
    }
    this.root.append(block);
  }

  setHandler(handler: Consumer<ActionsWidget>) {
    this.handler = handler;
  }

  private createActions(ctx: ActionDescriptors) {
    return [
      ctx.bind('next', async () => this.select(this.current + 1)),
      ctx.bind('prev', async () => this.select(this.current - 1)),
      ctx.bind('next-page', async () => this.select(this.current + 10)),
      ctx.bind('prev-page', async () => this.select(this.current - 10)),
      ctx.bind('select', async () => this.action(this.current)),
    ];
  }

  private action(idx: number) {
    if (idx < 0 || idx >= this.itemsList.length) return;
    const rec = this.itemsList[idx];
    rec.item.defaultAction.map(async x => { await x(); this.handler?.(rec.item) })
  }

  private select(idx: number): void {
    if (this.itemsList.length == 0) return;
    const nidx = clamp(idx, 0, this.itemsList.length - 1);
    if (nidx == this.current) return;
    this.clearSelection();
    this.current = nidx;
    const block = this.itemsList[nidx].block;
    block.mod(clazz.add('active'));
    this.autoScroller.show(block.cast());
  }

  clearSelection(): void {
    if (this.current == -1) return;
    this.itemsList[this.current].block.mod(clazz.remove('active'));
    this.current = -1;
  }

  actions(): Iterable<Action> {
    if (this.current == -1) return this.aList;
    const selected = this.itemsList[this.current].item;
    return chain(selected.actions(), this.aList);
  }

  asWidget(): Block {
    return this.root;
  }
}