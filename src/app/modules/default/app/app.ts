import { App } from "../../../apis/app1";
import { DefaultLogger } from "./logger";
import { DefaultScheduler } from "./scheduler";
import { DefaultStorages } from "./storage";


export function DefaultApp(appName: string): App {
  const logger = DefaultLogger();
  const timer = () => performance.now();
  const storages = DefaultStorages(appName);
  const scheduler = DefaultScheduler(requestAnimationFrame);
  return { logger, timer, storages, scheduler };
}