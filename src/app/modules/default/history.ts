import { Board } from "../../../build/board/structs";
import { Deck } from "../../../utils/collections";
import { Injector } from "../../../utils/injector";
import { BoardManipulator_, BoardProvider, DEFAULT_BOARD } from "../../apis/app";
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
  const cloner = await injector.getInstance(BoardManipulator_);
  const defaultBoard = await injector.getInstance(DEFAULT_BOARD);
  const history = new History();
  let activeBoard: Board = cloner.cloneBoard(defaultBoard);
  history.push(cloner.cloneBoard(defaultBoard));

  bus.connect(new class extends MessageHandlerReflective {
    NamedMessage(msg: NamedMessage) {
      switch (msg.name) {
        case 'undo':
          history.pop();
          activeBoard = cloner.cloneBoard(history.top());
          bus.handle(INVALIDATE_ALL);
          return;
        case 'commit':
          history.push(cloner.cloneBoard(activeBoard));
          return;
      }
    }

    LoadBoard(msg: LoadBoard) {
      activeBoard = cloner.cloneBoard(msg.board);
      history.push(cloner.cloneBoard(msg.board));
      bus.handle(INVALIDATE_ALL);
    }
  })

  return () => activeBoard;
}