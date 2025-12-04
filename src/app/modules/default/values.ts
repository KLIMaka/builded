import { Values } from "app/apis/values";
import { ValuesContainer } from "ts-utils/callbacks";
import { Plugin, provider } from "ts-utils/injector";


export const DefaultValuesConstructor: Plugin<Values> = provider(async injector => {
  let id = 0;
  const localValues = new ValuesContainer('values');
  const root = localValues.value<ValuesContainer[]>('root', []);
  const create = (name: string, parent: ValuesContainer) => {
    const nameId = `${name}-[0x${(id++).toString(16).padStart(8, '0')}]`;
    const result = new ValuesContainer(nameId, create, parent);
    result.addDisconnector(() => root.mod(cs => cs.filter(c => c !== result)));
    setTimeout(() => root.mod(cs => [...cs, result]));
    return result;
  }

  return { create, root }
});
