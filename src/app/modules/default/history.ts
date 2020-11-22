import { Board } from "../../../build/board/structs";
import { Deck } from "../../../utils/collections";
import { Injector } from "../../../utils/injector";
import { info } from "../../../utils/logger";
import { BoardProvider, ENGINE_API } from "../../apis/app";
import { BUS, MessageHandlerReflective } from "../../apis/handler";
import { Commit, INVALIDATE_ALL, LoadBoard, NamedMessage } from "../../edit/messages";

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
  const forward = new Deck<Board>();
  let activeBoard: Board = api.cloneBoard(defaultBoard);
  let lastTag = '';
  history.push(api.cloneBoard(defaultBoard));

  bus.connect(new class extends MessageHandlerReflective {
    NamedMessage(msg: NamedMessage) {
      switch (msg.name) {
        case 'undo':
          forward.push(api.cloneBoard(activeBoard));
          history.pop();
          activeBoard = api.cloneBoard(history.top());
          bus.handle(INVALIDATE_ALL);
          lastTag = '';
          return;
        case 'redo':
          if (forward.length() == 0) return;
          activeBoard = forward.top();
          history.push(api.cloneBoard(activeBoard));
          forward.pop();
          lastTag = '';
          bus.handle(INVALIDATE_ALL);
          return;
      }
    }

    Commit(msg: Commit) {
      forward.clear();
      if (msg.merge && msg.tag == lastTag) history.pop();
      else info(msg.tag);
      history.push(api.cloneBoard(activeBoard));
      lastTag = msg.tag;
    }

    LoadBoard(msg: LoadBoard) {
      activeBoard = api.cloneBoard(msg.board);
      history.push(api.cloneBoard(msg.board));
      lastTag = '';
      bus.handle(INVALIDATE_ALL);
    }
  })

  return () => activeBoard;
}