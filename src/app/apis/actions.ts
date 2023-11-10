
export interface Action {
  readonly id: string;
  readonly description: string;
}


export class ActionRegistry {
  private actions = new Map<string, Action>();

  register(action: Action): void {
    if (this.actions.has(action.id)) throw new Error(`Action ${action.id} already registered`);
    this.actions.set(action.id, action);
  }
}

export interface Action {

}

export class Action1 {
  private actions = new Map<string, Action>();

  registerAction(id: string, handler: Action) {
    if (this.actions.has(id)) throw new Error(`Action ${id} already registered`);
    this.actions.set(id, handler);
  }

  handle(id: string, arg: any) {
    const handler = this.actions.get(id);
    handler.
  }
}

export interface ActionFactory {
  create(params: string): Action;
}