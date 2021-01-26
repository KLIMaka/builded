import { State } from "../../apis/app";

export class StateImpl implements State {
  private state: { [index: string]: any } = {};

  register<T>(name: string, defaultValue: T): void {
    const prevState = this.state[name];
    // if (prevState != undefined) throw new Error(`Redefining state ${name}`);
    this.state[name] = defaultValue;
  }

  set<T>(name: string, value: T): void {
    this.get(name);
    this.state[name] = value;
  }

  get<T>(name: string): T {
    const stateValue = this.state[name];
    if (stateValue == undefined) throw new Error(`State ${name} is unregistered`);
    return stateValue;
  }

  has(name: string): boolean {
    return this.state[name] != undefined;
  }
}