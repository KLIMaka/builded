import h from "stage0";
import { int } from "../../mathutils";
import { Formatter, Parser, ParseValidator } from "../../value";
import { Handle, setter, Validator } from "./api";

function wheelAction(handle: Handle<number>, set: (x: number) => void, model: NumberModel) {
  return (e: WheelEvent) => {
    const scale = e.altKey ? model.microStep : e.shiftKey ? model.macroStep : model.step;
    if (e.deltaY < 0) { set(handle.get() + scale); e.preventDefault() }
    if (e.deltaY > 0) { set(handle.get() - scale); e.preventDefault() }
  }
}

function arrowAction(handle: Handle<number>, set: (x: number) => void, model: NumberModel) {
  return (e: KeyboardEvent) => {
    const scale = e.altKey ? model.microStep : e.shiftKey ? model.macroStep : model.step;
    if (e.code == 'ArrowUp') { set(handle.get() + scale); e.preventDefault() }
    if (e.code == 'ArrowDown') { set(handle.get() - scale); e.preventDefault() }
  }
}

const IntParseValidator: ParseValidator = (str: string) => !isNaN(Number.parseInt(str));
const FloatParseValidator: ParseValidator = (str: string) => !isNaN(Number.parseFloat(str));
const IntParser: Parser<number> = Number.parseInt;
const FloatParser: Parser<number> = Number.parseFloat;
const NUMBER_FMT = Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: false }).format;
export const intNumberValidator: Validator<number> = (v: number) => int(v) == v;

export type NumberModel = {
  parseValidator: ParseValidator,
  parser: Parser<number>,
  formatter: Formatter<number>,
  validator: Validator<number>,
  step: number,
  microStep: number,
  macroStep: number
}

const DEFAULT_MODEL: NumberModel = {
  parseValidator: FloatParseValidator,
  parser: FloatParser,
  formatter: NUMBER_FMT,
  validator: () => true,
  step: 1,
  microStep: 0.1,
  macroStep: 10
}

export class NumberModelBuilder {
  parseValidator: ParseValidator = FloatParseValidator;
  parser: Parser<number> = FloatParser;
  formatter: Formatter<number> = NUMBER_FMT;
  validator: Validator<number> = () => true;
  step: number = 1;
  microStep: number = 0.1;
  macroStep: number = 10;

  constructor(base: NumberModel = DEFAULT_MODEL) {
    this.parseValidator = base.parseValidator;
    this.parser = base.parser;
    this.formatter = base.formatter;
    this.validator = base.validator;
    this.step = base.step;
    this.microStep = base.microStep;
    this.macroStep = base.macroStep;
  }

  parse(parser: Parser<number>, validator: ParseValidator): NumberModelBuilder {
    this.parser = parser;
    this.parseValidator = validator;
    return this;
  }

  validation(validator: Validator<number>) {
    this.validator = validator;
    return this;
  }

  steps(step: number, microStep: number, macroStep: number) {
    this.step = step;
    this.microStep = microStep;
    this.macroStep = macroStep;
    return this;
  }


  build(): NumberModel { return this }
}

export const FLOAT_MODEL = new NumberModelBuilder()
  .build();

export const INT_MODEL = new NumberModelBuilder()
  .parse(IntParser, IntParseValidator)
  .validation(intNumberValidator)
  .steps(1, 1, 10)
  .build()

export function numberBox(handle: Handle<number>, model: NumberModel): HTMLElement {
  const formatValue = () => model.formatter(handle.get());
  const boxTemplate = h`<span class="textbox-wrapper"><input type="text" value="${formatValue()}" class="textbox input-widget" #box></span>`;
  const widget = <HTMLElement>boxTemplate.cloneNode(true);
  const { box } = boxTemplate.collect(widget);
  const refresh = () => box.value = formatValue();
  const set = setter(x => handle.set(x), model.validator);
  const parseSet = setter(v => set(model.parser(v)), model.parseValidator);
  box.oninput = () => parseSet(box.value);
  box.onkeydown = arrowAction(handle, set, model);
  box.onwheel = wheelAction(handle, set, model);
  box.addEventListener('focusout', refresh);
  handle.add(refresh);
  return widget;
}