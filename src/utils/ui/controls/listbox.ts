import h from "stage0";
import tippy, { Instance, Props } from "tippy.js";
import { map } from "../../collections";
import { div, Element, replaceContent } from "../ui";
import { Handle, Oracle } from "./api";

const listBoxTemplate = h`
<span class="listbox-wrapper btn btn-default" #widget>
  <span class="icon hidden" #icon></span>
  <input type="text" class="textbox" spellcheck="false" #input>
  <span class="icon icon-down-open-mini hidden" #icondrop></span>
</span>
`;

interface SuggestionModel {
  readonly widget: HTMLElement,
  shift(d: number): void;
  select(): void;
}

export function listBox(hint: string, ico: string, oracle: Oracle<string>, handle: Handle<string>, trackInput = false): HTMLElement {
  const root = listBoxTemplate.cloneNode(true);
  const { widget, input, icon, icondrop } = listBoxTemplate.collect(root);
  if (ico != null) {
    icon.classList.remove('hidden');
    icon.classList.add(ico);
  }
  if (!trackInput) icondrop.classList.remove('hidden');
  const suggestContainer = div('suggest').elem();
  let suggestModel: SuggestionModel = null;
  const suggestions = menu(input, suggestContainer);
  suggestions.setProps({ onHide: () => { input.value = handle.get() } })
  handle.add(() => { input.value = handle.get(); suggestions.hide(); });
  const update = (it: Iterable<string>) => {
    const items = [...it];
    if (items.length == 0) return;
    suggestModel = sugggestionsMenu(map(items, i => [i, () => handle.set(i)]));
    replaceContent(suggestContainer, suggestModel.widget);
    suggestions.show();
  }
  if (trackInput) input.oninput = () => { handle.set(input.value); update(oracle(input.value)); }
  input.placeholder = hint;
  input.value = handle.get();
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key == 'ArrowDown') suggestModel.shift(1)
    else if (e.key == 'ArrowUp') suggestModel.shift(-1)
    else if (e.key == 'Enter') suggestModel.select()
    else if (e.key == 'Escape') suggestions.hide()
  });
  widget.onclick = () => update(oracle(''));
  return widget;
}


const EMPTY_SUGGESTIONS: SuggestionModel = {
  widget: div('hidden').elem(),
  shift: (d: number) => { },
  select: () => { }
}

function sugggestionsMenu(items: Iterable<[string, () => void]>): SuggestionModel {
  const menu = div('menu menu-default');
  let selected = -1;
  const options: [Element, () => void][] = [];
  for (const [label, click] of items) {
    const item = div('menu-item').text(label).click(() => click());
    options.push([item, click]);
    menu.append(item);
  }
  if (options.length == 0) return EMPTY_SUGGESTIONS;
  const unselect = (sel: number) => { if (sel >= 0 && sel < options.length) options[selected][0].elem().classList.remove('selected') }
  const select = (newSelected: number) => {
    unselect(selected);
    options[newSelected][0].elem().classList.add('selected');
    selected = newSelected;
  }
  return {
    widget: menu.elem(),
    shift(d: number) { select(Math.min(Math.max(0, selected + d), options.length - 1)) },
    select() { options[selected][1]() }
  }
}

function menu(input: HTMLElement, suggestContainer: HTMLElement): Instance<Props> {
  return tippy(input, {
    allowHTML: true,
    placement: 'bottom-start',
    interactive: true,
    content: suggestContainer,
    trigger: 'focus',
    arrow: false,
    offset: [0, 0],
    appendTo: document.body
  });
}


