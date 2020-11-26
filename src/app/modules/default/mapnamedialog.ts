import { Ui, UI, Window } from "../../apis/ui";
import { div, span, tag } from '../../../utils/ui/ui';
import { Injector } from "../../../utils/injector";
import { PhotonDialog } from "../photonui";


let selectMapNameWindow: Window;
let applyCallback: (name: string) => void;
async function getWindow(injector: Injector) {
  const ui = await injector.getInstance(UI);
  if (selectMapNameWindow == null) {
    const input = tag('input').attr('type', 'text').className('form-control').css('width', '300px');
    const form = tag('form').css('padding', '10px')
      .append(div('form-group')
        .append(tag('label').text('Name: '))
        .append(input));

    selectMapNameWindow = new PhotonDialog('Map Name');
    selectMapNameWindow.contentElement.appendChild(form.elem());
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
