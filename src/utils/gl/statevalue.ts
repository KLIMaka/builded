
export interface StateValue<T> {
  get(): T;
  set(v: T): void;
}

export class StateValueGeneric<T> implements StateValue<T>{
  constructor(
    private changecb: () => void,
    public value: T,
  ) { }
  get(): T { return this.value; }
  set(v: T) {
    if (v !== this.value) {
      this.value = v;
      this.changecb()
    }
  }
}

export class StateValueMatrix<T> {
  constructor(
    private changecb: () => void,
    public value: T,
    public cmp: (lh: T, rh: T) => boolean,
    public setter: (dst: T, src: T) => T
  ) { }
  get(): T { return this.value; }
  set(v: T) {
    if (!this.cmp(v, this.value)) {
      this.setter(this.value, v);
      this.changecb();
    }
  }
}