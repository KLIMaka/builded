import { Function, Supplier } from "@utils/types";
import { Block, Ui } from "app/apis/ui";
import { CallbackChannel, Source } from "../../../utils/callbacks";
import { VecStack } from "../../../utils/vecstack";

export type Property = { label: string, widget: Block }
export type PropertySection = { title: string, props: Property[][] }
export type Renderer = (stack: VecStack, pos: number) => number;
export type Value<T> = Source<T> & CallbackChannel<T>;
export type Image = { renderer: Value<Renderer>, settings: Value<PropertySection[]>, dependsOn(img: Image): boolean }

export interface Context {
  imageProvider(): Function<string, Image>;
  images(img: Image): Supplier<Iterable<string>>;
  stack(): VecStack;
  currentImageName(): string;
  ui(): Ui;
}

export function propSection(title: string, ...props: Property[]): PropertySection[] {
  return [{ title, props: props.map(p => [p]) }]
}

export function propSectionGroups(title: string, ...props: Property[][]): PropertySection[] {
  return [{ title, props: props }]
}