import { Board } from "../../../build/board/structs";
import { Deck } from "../../../utils/collections";
import { Injector } from "../../../utils/injector";
import { BoardProvider, ENGINE_API } from "../../apis/app";
import { BUS, MessageHandlerReflective } from "../../apis/handler";
import { INVALIDATE_ALL, LoadBoard, NamedMessage } from "../../edit/messages";

class History {
  private history: Deck<Board> = new Deck();
  public push(board: Board) { this.history.push(board) }
  public pop() { if (this.history.length() > 1) this.history.pop() }
  public top() { return this.history.top() }
}

export async function DefaultBoardProviderConstructor(injector: Injector): Promise<BoardProvider> {
  const bus = await injector.getInstance(BUS);
  const api = await injector.getInstance(ENGINE_API);
  const defaultBoard = api.newBoard();
  const history = new History();
  let activeBoard: Board = api.cloneBoard(defaultBoard);
  history.push(api.cloneBoard(defaultBoard));

  bus.connect(new class extends MessageHandlerReflective {
    NamedMessage(msg: NamedMessage) {
      switch (msg.name) {
        case 'undo':
          history.pop();
          activeBoard = api.cloneBoard(history.top());
          bus.handle(INVALIDATE_ALL);
          return;
        case 'commit':
          history.push(api.cloneBoard(activeBoard));
          return;
      }
    }

    LoadBoard(msg: LoadBoard) {
      activeBoard = api.cloneBoard(msg.board);
      history.push(api.cloneBoard(msg.board));
      bus.handle(INVALIDATE_ALL);
    }
  })

  return () => activeBoard;
}