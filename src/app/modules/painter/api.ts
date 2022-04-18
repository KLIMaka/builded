import { CallbackChannel, Source } from "../../../utils/callbacks";
import { VecStack } from "../../../utils/vecstack";
import { Oracle } from "../../../utils/ui/controls/api";

export type Property = { label: string, widget: HTMLElement }
export type Renderer = (stack: VecStack, pos: number) => number;
export type Value<T> = Source<T> & CallbackChannel<[]>;
export type Image = { renderer: Value<Renderer>, settings: Value<Property[]>, dependsOn(img: Image): boolean }

export interface Context {
  imageProvider(): (name: string) => Image;
  oracle(img: Image): Oracle<string>;
  stack(): VecStack;
  currentImageName(): string;
}