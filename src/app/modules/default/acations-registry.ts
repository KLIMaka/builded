import { TypeDescriptor } from "../../../utils/type-descriptor";



export interface ActionParameter<T> {
  readonly name: string;
  readonly type: TypeDescriptor<T>
}

export interface Action {
  run(): Promise<void>;
  readonly name: string;
  readonly description: string;
  readonly params: ActionParameter<any>[];
}

