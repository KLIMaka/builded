import { Ui, UI, Window } from "../../apis/ui";
import { tag } from '../../../utils/ui/ui';
import { Injector } from "../../../utils/injector";


let selectMapNameWindow: Window;
let applyCallback: (name: string) => void;
async function getWindow(injector: Injector) {
  const ui = await injector.getInstance(UI);
  if (selectMapNameWindow == null) {
    const input = tag('input').attr('type', 'text').className('form-control');
    const form = tag('form').css('width', '100%').css('padding', '10px').append(input);
    const okButton = tag('button').className('btn btn-primary pull-right').text('Ok').css('width', '75px').click(() => applyCallback(((<HTMLInputElement>input.elem()).value)));
    selectMapNameWindow = ui.builder.window().title('Map Name')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 50)
      .content(form.elem())
      .toolbar(ui.builder.toolbar().footer().widget(okButton.elem()))
      .build();
  }
  return selectMapNameWindow;
}

export function showMapNameSelection(injector: Injector): Promise<string> {
  return new Promise(async resolve => {
    const win = await getWindow(injector);
    win.onclose = () => resolve(null);
    applyCallback = (name: string) => { win.hide(); resolve(name); }
    win.show();
  })
}
