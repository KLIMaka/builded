import { Activity, ActivityManager } from "../../apis/app";
import { Message, MessageHandlerReflective } from "../../apis/handler";

class DefaultActivityManager extends MessageHandlerReflective implements ActivityManager {
  private activities = new Map<string, Activity>();
  private current: Activity;

  public register(activity: Activity) {
    if (this.activities.has(activity.name())) throw new Error(`Activity ${activity.name()} already registered`);
    this.activities.set(activity.name(), activity);
  }

  public handle(message: Message): void {
    if (this.current == null) return;
    this.current.handle(message);
  }

  public async goTo(name: string) {
    const act = this.activities.get(name);
    if (act == null) throw new Error(`Activity ${name} is unregistered`);
    if (this.current != null) await this.current.goBack();
    await act.goFront();
    this.current = act;
  }
}
