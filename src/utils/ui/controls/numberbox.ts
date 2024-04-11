import { Value } from "@utils/callbacks";
import { Block, Ui, clazz, style } from "app/apis/ui";
import { clamp, int } from "../../mathutils";
import { Formatter, ParseValidator, Parser } from "../../value";
import { Validator, setter } from "./api";
import { dragElement } from "../ui";
import Optional from "optional-js";
import { Consumer, Supplier, identity } from "@utils/types";
import { Transformer } from "@utils/type-descriptor";

function wheelAction(value: Supplier<number>, set: Consumer<number>, model: NumberModel) {
  return (e: WheelEvent) => {
    const scale = e.altKey ? model.microStep : e.shiftKey ? model.macroStep : model.step;
    if (e.deltaY < 0) { set(value() + scale); e.preventDefault() }
    if (e.deltaY > 0) { set(value() - scale); e.preventDefault() }
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
  macroStep: number,
  clamper: Transformer<number>
}

const DEFAULT_MODEL: NumberModel = {
  parseValidator: FloatParseValidator,
  parser: FloatParser,
  formatter: NUMBER_FMT,
  validator: () => true,
  step: 1,
  microStep: 0.1,
  macroStep: 10,
  clamper: identity()
}

export class NumberModelBuilder {
  parseValidator: ParseValidator = FloatParseValidator;
  parser: Parser<number> = FloatParser;
  formatter: Formatter<number> = NUMBER_FMT;
  validator: Validator<number> = () => true;
  step: number = 1;
  microStep: number = 0.1;
  macroStep: number = 10;
  clamper: Transformer<number>;

  constructor(base: NumberModel = DEFAULT_MODEL) {
    this.parseValidator = base.parseValidator;
    this.parser = base.parser;
    this.formatter = base.formatter;
    this.validator = base.validator;
    this.step = base.step;
    this.microStep = base.microStep;
    this.macroStep = base.macroStep;
    this.clamper = base.clamper;
  }

  parse(parser: Parser<number>, validator: ParseValidator): this {
    this.parser = parser;
    this.parseValidator = validator;
    return this;
  }

  validation(validator: Validator<number>): this {
    this.validator = validator;
    return this;
  }

  steps(step: number, microStep: number, macroStep: number): this {
    this.step = step;
    this.microStep = microStep;
    this.macroStep = macroStep;
    return this;
  }

  range(min: number, max: number): this {
    this.clamper = x => clamp(x, min, max);
    return this;
  }

  build(): this { return this }
}

export const FLOAT_MODEL = new NumberModelBuilder()
  .build();

export const INT_MODEL = new NumberModelBuilder()
  .parse(IntParser, IntParseValidator)
  .validation(intNumberValidator)
  .steps(1, 1, 10)
  .build()

export function numberBox(ui: Ui, value: Value<number>, model: NumberModel, width: Optional<string> = Optional.empty(), pre: Optional<string> = Optional.empty(), post: Optional<string> = Optional.empty()): Block {
  const actionsContext = ui.actionDescriptors().sub('controls.numberbox');
  let editValue = value.get();
  let resetValue = value.get();
  const actions = [
    actionsContext.bindSync('step-up', () => set(editValue + model.step)),
    actionsContext.bindSync('step-down', () => set(editValue - model.step)),
    actionsContext.bindSync('micro-step-up', () => set(editValue + model.microStep)),
    actionsContext.bindSync('micro-step-down', () => set(editValue - model.microStep)),
    actionsContext.bindSync('macro-step-up', () => set(editValue + model.macroStep)),
    actionsContext.bindSync('macro-step-down', () => set(editValue - model.macroStep)),
    actionsContext.bindSync('escape', () => { editValue = resetValue; input.mod(e => e.blur()) }),
    actionsContext.bindSync('enter', () => { resetValue = editValue; value.set(resetValue) }),
    actionsContext.bindSync('undo', () => { editValue = resetValue; refresh() }),
  ]
  const actionsProvider = { actions: () => actions };
  const formatValue = () => model.formatter(editValue);
  const input = ui.tag('input', 'number-box-input')
    .mod(e => { e.setAttribute('type', 'text'); e.setAttribute('value', formatValue()) });
  const left = ui.block('fa-solid', 'fa-angle-left', 'number-box-addon')
    .event('click', e => { set(editValue - (e.altKey ? model.microStep : e.shiftKey ? model.macroStep : model.step)); value.set(editValue) });
  const right = ui.block('fa-solid', 'fa-angle-right', 'number-box-addon')
    .event('click', e => { set(editValue + (e.altKey ? model.microStep : e.shiftKey ? model.macroStep : model.step)); value.set(editValue) });
  const preAdd = ui.block('number-box-addon-permanent');
  pre.ifPresent(p => preAdd.text(p));
  const postAdd = ui.block('number-box-addon-permanent');
  post.ifPresent(p => postAdd.text(p));
  const root = ui.row(['number-box'])
    .insert(left)
    .insert(preAdd)
    .insert(input, '1')
    .insert(postAdd)
    .insert(right);
  width.ifPresent(w => root.asWidget().mod(style.width(w)));
  const box: HTMLInputElement = input.cast();
  const refresh = () => box.value = formatValue();
  const set = setter(x => { editValue = model.clamper(x); refresh() }, model.validator);
  const parseSet = setter(v => set(model.parser(v)), model.parseValidator);
  input.event('input', _ => parseSet(box.value));
  const setValue = setter(x => { editValue = model.clamper(x); value.set(editValue) }, model.validator);
  input.event('wheel', wheelAction(() => value.get(), setValue, model));
  input.event('focusin', _ => { editValue = resetValue = value.get(); ui.setTopActionsProvider(actionsProvider); root.asWidget().mod(clazz.add('edit')) });
  input.event('focusout', _ => { value.set(editValue); ui.setTopActionsProvider(null); refresh(); root.asWidget().mod(clazz.remove('edit')) });
  let start = 0;
  dragElement(input.cast(), 'progress', (dx, dy) => { set(start - dx) }, () => { start = value.get(); }, () => { value.set(editValue); }, () => box.select());
  value.add(refresh);
  return root.asWidget();
}