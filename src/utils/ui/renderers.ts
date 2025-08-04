import { Value } from "ts-utils/callbacks";
import { Supplier } from "ts-utils/types";
import { Property, PropertySection } from "app/modules/painter/api";
import { listBuilder } from "app/modules/ui/builders";
import { Block, Ui, clazz } from "../../app/apis/ui";
import { iter } from "../iter";
import { FLOAT_MODEL, NumberModel, numberBox } from "./controls/numberbox";

export function widgetProp(label: string, widget: Block): Property {
  return { label, widget };
}

export function rangeProp(ui: Ui, label: string, handle: Value<number>, model: NumberModel = FLOAT_MODEL): Property {
  return widgetProp(label, numberBox(ui, handle, model));
}

export function listProp(ui: Ui, label: string, values: Supplier<Iterable<string>>, value: Value<string>): Property {
  const listbox = listBuilder(ui, value).provider(values).search().build();
  return widgetProp(label, listbox);
}

export function section(ui: Ui, title: string, content: Block): Block {
  const sectionContent = ui.block('section-content').append(ui.block('section-content-inner').append(content));
  return ui.block('section')
    .append(ui.block('section-head').text(title).event('click', () => sectionContent.mod(clazz.toggle('closed'))))
    .append(sectionContent);
}

export function props(ui: Ui, props: Property[][]): Block {
  const root = ui.block('props');
  for (const pp of props) {
    iter(pp).enumerate().forEach(([p, i]) => {
      if (pp.length != 1) {
        const pos = i == 0 ? 'top' : i == pp.length - 1 ? 'bottom' : 'mid';
        p.widget.mod(clazz.add((pos)));
      }
      root
        .append(ui.block('prop-label').text(p.label))
        .append(ui.block('prop-content').append(p.widget));
    });
    root.append(ui.block('prop-spacer'));
  }
  return root;
}

export function propSections(ui: Ui, sections: PropertySection[]): Block {
  const root = ui.block('stack', 'padded-5');
  for (const s of sections) {
    root.append(section(ui, s.title, props(ui, s.props)))
  }
  return root;
}
