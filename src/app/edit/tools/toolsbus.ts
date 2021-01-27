import { any, findFirst, forEach } from "../../../utils/collections";
import { Dependency, Injector } from "../../../utils/injector";
import { BUS, Handle, Message, MessageBus, MessageHandler, MessageHandlerReflective } from "../../apis/handler";

export const TOOLS_BUS = new Dependency<ToolsMessageBus>("ToolsBus");

export const ToolsBusConstructor = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      const toolsBus = new ToolsMessageBus();
      handle = bus.connect(toolsBus);
      return toolsBus;
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    }
  }
})();

export interface Tool extends MessageHandler {
  activateHandler(handler: (tool: Tool) => void): void;
  deactivateHandler(handler: (tool: Tool) => void): void;
};

export class DefaultTool extends MessageHandlerReflective implements Tool {
  private active = false;
  private activateH: (tool: Tool) => void;
  private deactivateH: (tool: Tool) => void;
  activateHandler(handler: (tool: Tool) => void): void { this.activateH = handler }
  deactivateHandler(handler: (tool: Tool) => void): void { this.deactivateH = handler }
  protected activate() { this.activateH(this); this.active = true }
  protected deactivate() { this.deactivateH(this); this.active = false }
  protected isActive() { return this.active }
}

class ToolsMessageBus implements MessageBus {
  private activeTool: Tool = null;
  private lastHandle = 1;
  private tools = new Map<number, Tool>();

  connect(tool: Tool): Handle {
    if (any(this.tools.values(), t => t == tool)) throw new Error(`Tool ${tool} already bound`);
    this.tools.set(this.lastHandle, tool);
    tool.activateHandler(tool => this.activateTool(tool));
    tool.deactivateHandler(tool => this.deactivateTool(tool));
    return this.lastHandle++;
  }

  disconnect(handle: Handle): void {
    const id = <number>handle;
    const tool = this.tools.get(id);
    if (tool == this.activeTool) throw new Error();
    this.tools.delete(id);
  }

  private activateTool(tool: Tool) {
    if (this.activeTool != null && this.activeTool != tool) {
      this.activeTool = null;
      throw new Error('');
    }
    this.activeTool = tool;
  }

  private deactivateTool(tool: Tool) {
    if (this.activeTool != tool) throw new Error();
    this.activeTool = null;
  }

  handle(message: Message): void {
    if (this.activeTool != null) this.activeTool.handle(message);
    else forEach(this.tools.values(), t => t.handle(message));
  }
}