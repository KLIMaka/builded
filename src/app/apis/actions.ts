
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