import { forEach } from "../../../utils/collections";
import { Dependency, Injector } from "../../../utils/injector";
import { BUS, Message, MessageBus, MessageHandler, MessageHandlerReflective } from "../../apis/handler";

export const TOOLS_BUS = new Dependency<ToolsMessageBus>("ToolsBus");

export async function ToolsBusConstructor(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  const toolsBus = new ToolsMessageBus();
  bus.connect(toolsBus);
  return toolsBus;
}

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

class ToolsMessageBus implements MessageHandler {
  private tools: Tool[] = [];
  private activeTool: Tool = null;

  public connect(tool: Tool) {
    if (this.tools.indexOf(tool) != -1) throw new Error(`Tool ${tool} already bound`);
    this.tools.push(tool);
    tool.activateHandler(tool => this.activateTool(tool));
    tool.deactivateHandler(tool => this.deactivateTool(tool));
  }

  private activateTool(tool: Tool) {
    if (this.activeTool != null && this.activeTool != tool) throw new Error('');
    this.activeTool = tool;
  }

  private deactivateTool(tool: Tool) {
    if (this.activeTool != tool) throw new Error();
    this.activeTool = null;
  }

  handle(message: Message): void {
    if (this.activeTool != null) this.activeTool.handle(message);
    else forEach(this.tools, t => t.handle(message));
  }
}