import { Supplier } from "@utils/types";
import { Ui } from "app/apis/ui";
import { transformed, value } from "../../../../utils/callbacks";
import { iter } from "../../../../utils/iter";
import { FLOAT_MODEL, NumberModel } from "../../../../utils/ui/controls/numberbox";
import { listProp, rangeProp } from "../../../../utils/ui/renderers";
import { VecStack } from "../../../../utils/vecstack";
import { Image, Property, PropertySection, Renderer, Value } from "../api";

export type Parameter<T> = { value: Value<T>, prop: Property };

export function param(ui: Ui, name: string, def: number): Parameter<number> {
  return paramModel(ui, name, def, FLOAT_MODEL);
}

export function paramModel(ui: Ui, name: string, def: number, model: NumberModel): Parameter<number> {
  const val = value(def);
  return { value: val, prop: rangeProp(ui, name, val, model) }
}

export function transformedParam<T>(ui: Ui, name: string, trans: (name: string) => T, images: Supplier<Iterable<string>>, def = ''): Parameter<T> {
  const valueName = value(def);
  const val = transformed(valueName, trans);
  return { value: val, prop: listProp(ui, name, images, valueName) }
}

export function dependencyChecker(current: Image, deps: Value<Image>[]) {
  return (img: Image) => {
    if (current === img) return true;
    return iter(deps).map(d => d.get()).any(i => i != null && i.dependsOn(img))
  };
}

export class ImageBuilder {
  private image: Image = { renderer: null, dependsOn: null, settings: null };
  private deps: Value<Image>[] = []

  public renderer(renderer: Value<Renderer>) { this.image.renderer = renderer; return this }
  public settings(settings: Value<PropertySection[]>) { this.image.settings = settings; return this }
  public dependency(dep: Value<Image>) { this.deps.push(dep); return this }
  public object() { return this.image }

  public build(): Image {
    this.image.dependsOn = dependencyChecker(this.image, this.deps);
    if (this.image.renderer == null) throw new Error('Renderer is absent');
    if (this.image.settings == null) throw new Error('Settings is absent');
    return this.image;
  }
}

export const VOID_RENDERER = (stack: VecStack, pos: number) => stack.push(0, 0, 0, 0);
