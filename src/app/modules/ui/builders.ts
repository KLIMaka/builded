import { Value } from "@utils/callbacks";
import { EMPTY_COLLECTION, chain, getOrCreate, singleton } from "@utils/collections";
import { iter } from "@utils/iter";
import { Consumer, Function, Predicate, Supplier, Transform, nil } from "@utils/types";
import { Oracle } from "@utils/ui/controls/api";
import { Action, ActionHandler, ActionsProvider } from "app/apis/actions";
import { ActionsList, ActionsWidget, Block, BlockBuilder, ElemMod, GroupsModel, Menu, Selector, TableColumn, TableModel, Ui, Widget, WidgetRenderer, clazz } from "app/apis/ui";
import { Bind } from "app/input/keymap";
import Optional from "optional-js";
import { ActionsListImpl } from "./actions-list";
import { GroupsModelImpl } from "./groups";
import { MenuImpl } from "./menu";
import { TableModelImpl } from "./table";

export function rowGroup<T>(ui: Ui, rootClass?: string[], itemClass?: string[], renderer: Function<T, Block> = item => ui.block().text(item.toString())): GroupsModel<T> {
  return new GroupsModelImpl(
    () => ui.row(rootClass, ['group-item-base', 'hgroup-item', ...itemClass]),
    renderer,
    ui.row()
  );
}

export function columnGroup<T>(ui: Ui, rootClass?: string[], itemClass?: string[], renderer: Function<T, Block> = item => ui.block().text(item.toString())): GroupsModel<T> {
  return new GroupsModelImpl(
    () => ui.column(rootClass, ['group-item-base', 'vgroup-item', ...itemClass]),
    renderer,
    ui.column()
  );
}

export function insertItems<T>(model: GroupsModel<T>, items: T[][]): GroupsModel<T> {
  let first = true;
  for (const i of items) {
    if (!first) model.newBlock();
    first = false;
    i.forEach(ii => model.addItem(ii));
  }
  return model;
}

export function button(ui: Ui, clickHandler: Consumer<void>) {
  const block = ui.block('button');
  block.event('click', _ => clickHandler());
  return block;
}

export function column<R, T>(title: string, selector: Selector<R, T>, renderer: WidgetRenderer<T>, size = 'auto'): TableColumn<R, T> {
  return { title, selector, size, renderer }
}

export function iconText(ui: BlockBuilder, icon: string, text: string): Block {
  return ui.row(['nonwrap-row-block', 'baseline-aligned'])
    .classes(['icon', `icon-${icon}`])
    .insert(ui.block('nonwrap-row-block-item').text(text), '1')
    .asWidget()
}

export function table<R>(ui: Ui, classes: string[], columns: TableColumn<R, any>[]): TableModel<R> {
  const tableModel = new TableModelImpl<R>(ui, columns);
  tableModel.asWidget().mod(clazz.add(...classes));
  return tableModel;
}

export function actionsList(ui: Ui): ActionsList {
  return new ActionsListImpl(ui);
}

export function menu(ui: Ui, items: Iterable<ActionsWidget>): Menu {
  const widget = new MenuImpl(ui, items);
  return widget;
}

function parseKey(key: string) {
  if (key == 'control') return 'Ctrl';
  return key.toUpperCase();
}

function keybindRenderer(ui: Ui, bind: Bind): Block {
  const keyRenderer = (key: string) => ui.block('key').text(parseKey(key));
  const container = ui.block('keybind');
  if (!bind) return container;
  iter(bind.keys)
    .map(keyRenderer)
    .join(ui.block().mod(clazz.add('plus')).text('+'))
    .forEach(e => container.append(e));
  return container;
}

export function menuItem(ui: Ui, action: Action): ActionsWidget {
  const row = ui.row(['menu-item']);
  action.descriptor.icon().ifPresent(i => row.classes(['icon', `icon-${i}`]));
  action.descriptor.label().ifPresent(l => row.insert(ui.block().text(l), '1'));
  action.descriptor.bind().ifPresent(b => row.insert(keybindRenderer(ui, b)));
  const actions = singleton(action);
  return actionsWidget(() => row.asWidget(), Optional.of(action.handler), () => actions);
}

export function checkMenuItem(ui: Ui, text: string): ActionsWidget {
  let state = false;
  const toggle = () => {
    state = !state;
    renderCheckState(state, input);
  }
  const renderCheckState = (state: boolean, elem: Block) => {
    if (state) elem.mod(e => e.setAttribute('checked', ''));
    else elem.mod(e => e.removeAttribute('checked'));
  }
  const root = ui.block('check');
  const input = ui.tag('input').mod(e => e.setAttribute('type', 'checkbox'));
  renderCheckState(state, input);
  const widget = root.append(input)
    .append(ui.block('mark'))
    .append(ui.block().text(text));
  const action = ui.actionDescriptors().sub('controls').bind('check', async () => toggle());
  const actions = singleton(action);
  return actionsWidget(() => widget, Optional.of(action.handler), () => actions);
}

export function dropdownButton(ui: Ui, label: Block): Block {
  return ui.row(['button', 'baseline-aligned'])
    .insert(label, '1')
    .classes(['fa-solid', 'fa-angle-down']).asWidget();
}

interface HasSelectCallback {
  setSelectCallback(cb: Consumer<ActionsWidget>): void;
}

export interface SearchBox extends ActionsProvider, Widget, HasSelectCallback {
  resetList(): void;
  focusSearchbar(): void;
}

export function searchList(ui: Ui, oracle: Oracle<ActionsWidget>, selected: Predicate<ActionsWidget> = _ => false): SearchBox {
  const list = actionsList(ui);
  const searchbar = ui
    .tag('input', 'serach-list-input')
    .mod(e => { e.setAttribute('type', 'text'); e.setAttribute('placeholder', 'Search') })
    .event('input', () => updateList());
  const input: HTMLInputElement = searchbar.cast();
  const root = ui.column(['menu']).insert(searchbar).widget(list, '1');
  const updateList = () => { list.clear(); iter(oracle(input.value)).forEach(i => list.addItem(i, selected(i))) }
  return {
    actions: () => list.actions(),
    asWidget: () => root.asWidget(),
    resetList: () => { input.value = ''; updateList() },
    focusSearchbar: () => input.focus(),
    setSelectCallback: cb => list.setHandler(cb)
  };
}

export interface SimpleList extends ActionsProvider, Widget, HasSelectCallback {
  resetList(): void;
  setSelectCallback(cb: Consumer<ActionsWidget>): void;
}

export function simpleList(ui: Ui, items: ActionsWidget[], selected: Predicate<ActionsWidget> = _ => false): SimpleList {
  const list = actionsList(ui);
  const root = ui.column(['menu']).widget(list, '1');
  const updateList = () => { list.clear(); iter(items).forEach(i => list.addItem(i, selected(i))) }
  return {
    actions: () => list.actions(),
    asWidget: () => root.asWidget(),
    resetList: () => updateList(),
    setSelectCallback: cb => list.setHandler(cb)
  };
}

export function popupButton(ui: Ui, popoupContent: ActionsProvider & Widget & HasSelectCallback, label: Block, preShow: Consumer<void>, show: Consumer<void>): Block {
  let close: Consumer<void>;
  const root = popoupContent.asWidget();
  popoupContent.setSelectCallback(_ => close());
  const closeAction = ui.actionDescriptors().bind('close', async () => close());
  const widgetActions = { actions: () => chain(popoupContent.actions(), singleton(closeAction)) }
  const showList = () => { preShow(); root.mod(e => e.style.minWidth = `${button.cast().clientWidth}px`); close = ui.showPopup(button, root, widgetActions, nil()); show() }
  const button = dropdownButton(ui, label).event('click', showList);
  return button;
}

export function suggestionBox(ui: Ui, label: Block, oracle: Oracle<ActionsWidget>, selected: Predicate<ActionsWidget> = _ => false, search = true): Block {
  if (search) {
    const popupContent = searchList(ui, oracle, selected);
    const preShow = () => popupContent.resetList();
    const show = () => popupContent.focusSearchbar();
    return popupButton(ui, popupContent, label, preShow, show);
  } else {
    const popupContent = simpleList(ui, [...oracle('')], selected);
    const preShow = () => popupContent.resetList();
    return popupButton(ui, popupContent, label, preShow, nil());
  }
}

function list<T>(ui: Ui, values: Supplier<Iterable<T>>, value: Value<T>, renderer: Function<T, string> = v => v.toString(), labelRenderer = renderer, label = ui.block(), search = false): Block {
  const cache = new Map<T, ActionsWidget>();
  let selected: ActionsWidget = null;
  label.text(labelRenderer(value.get()));
  const createWidget = (item: T) => {
    const block = ui.block().text(renderer(item));
    const widget = {
      defaultAction: Optional.of(async () => value.set(item)),
      asWidget: () => block,
      actions: () => EMPTY_COLLECTION
    }
    if (item == value.get()) selected = widget;
    return widget;
  }
  const oracle = (s: string) => iter(values())
    .filter(n => renderer(n).toLowerCase().startsWith(s.toLowerCase()))
    .map(n => getOrCreate(cache, n, createWidget));
  value.add(v => { label.text(labelRenderer(v)); selected = cache.get(v) });
  return suggestionBox(ui, label, oracle, w => selected == w, search);
}

export class ListBuilder<T> {
  private itemsProvider: Supplier<Iterable<T>>;
  private itemRenderer: Function<T, string> = v => v.toString();
  private labelRenderer: Function<T, string> = this.itemRenderer;
  private labelBlock: Block;
  private enabledSearch = false;

  constructor(
    private ui: Ui,
    private value: Value<T>
  ) {
    this.labelBlock = ui.block();
  }

  items(items: Iterable<T>): this { this.itemsProvider = () => items; return this }
  provider(provider: Supplier<Iterable<T>>): this { this.itemsProvider = provider; return this }
  renderer(r: Function<T, string>): this { this.itemRenderer = r; return this }
  label(r: Transform<string>): this { this.labelRenderer = i => r(this.itemRenderer(i)); return this }
  labelPrefix(prefix: string): this { return this.label(s => prefix + s) }
  labelMod(e: ElemMod): this { this.labelBlock.mod(e); return this }
  search(): this { this.enabledSearch = true; return this }

  build(): Block {
    return list(this.ui, this.itemsProvider, this.value, this.itemRenderer, this.labelRenderer, this.labelBlock, this.enabledSearch)
  }
}

export function listBuilder<T>(ui: Ui, value: Value<T>): ListBuilder<T> {
  return new ListBuilder<T>(ui, value);
}

export interface SuggestionBox extends Widget {
  focus(): void;
}

export function suggestedTextBox(ui: Ui, value: Value<string>, oracle: Oracle<ActionsWidget>, icon: Optional<string> = Optional.empty(), placeholder: Optional<string> = Optional.empty()): SuggestionBox {
  const actionsContext = ui.actionDescriptors().sub('controls.textbox');
  const actions = [
    actionsContext.bindSync('close', () => { closeSuggestions(); input.blur() })
  ];
  const actionsProvider = { actions: () => chain(actions, list.actions()) };
  const list = actionsList(ui);
  const listRoot = ui.column(['menu']).widget(list, '1');

  const updateList = () => {
    list.clear();
    for (const item of oracle(input.value)) list.addItem(item);
  }

  let closeSuggestions: Consumer<void>;
  const showSuggestions = () => {
    updateList();
    listRoot.asWidget().mod(e => e.style.minWidth = `${root.asWidget().cast().clientWidth}px`);
    closeSuggestions = ui.showPopup(root.asWidget(), listRoot.asWidget(), actionsProvider, nil());
  }
  list.setHandler(() => { closeSuggestions(); input.blur() });

  const textBox = ui
    .tag('input')
    .mod(e => { e.setAttribute('type', 'text') })
    .event('input', _ => { value.set(input.value); updateList() })
    .event('focusin', _ => { showSuggestions(); input.select(); root.asWidget().mod(clazz.add('active')); ui.setTopActionsProvider(actionsProvider) })
    .event('focusout', _ => { root.asWidget().mod(clazz.remove('active')); ui.setTopActionsProvider(null) });
  placeholder.ifPresent(p => textBox.mod(e => e.setAttribute('placeholder', p)));
  const root = ui.row(['text-box', 'baseline-aligned']);
  icon.ifPresent(i => root.classes(['fa-solid', `fa-${i}`]));
  const clear = ui.block('fa-solid', 'fa-xmark')
    .mod(e => e.style.display = 'none')
    .event('click', _ => value.set(''));
  root
    .insert(textBox, '1')
    .insert(clear);
  const input: HTMLInputElement = textBox.cast();
  value.add(v => { input.value = v; clear.mod(e => e.style.display = v.length == 0 ? 'none' : 'block') });
  return {
    asWidget: () => root.asWidget(),
    focus: () => input.focus()
  }
}

export function asWidget(elem: Block): Widget {
  return { asWidget: () => elem }
}

export function actionsWidget(
  asWidget: Supplier<Block>,
  defaultAction: Optional<ActionHandler> = Optional.empty(),
  actions: Supplier<Iterable<Action>> = () => EMPTY_COLLECTION,
): ActionsWidget {
  return { defaultAction, actions, asWidget };
}

export function singleActionWidget(widget: Block, action: ActionHandler): ActionsWidget {
  return {
    defaultAction: Optional.of(action),
    actions: () => EMPTY_COLLECTION,
    asWidget: () => widget
  }
}
