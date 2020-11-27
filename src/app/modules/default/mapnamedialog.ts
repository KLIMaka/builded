import { Injector } from "../../../utils/injector";
import { tag } from '../../../utils/ui/ui';
import { PhotonDialog } from "../photonui";


let selectMapNameWindow: PhotonDialog;
let applyCallback: (name: string) => void;
let setDefaultName: (name: string) => void;
async function getWindow(injector: Injector) {
  if (selectMapNameWindow == null) {
    const input = <HTMLInputElement>tag('input')
      .attr('type', 'text')
      .attr('placeholder', 'Map Name')
      .className('form-control')
      .css('width', '300px').elem();
    const form = tag('form').css('padding', '10px 10px 5px 10px').appendHtml(input);
    setDefaultName = name => input.value = name;

    selectMapNameWindow = new PhotonDialog('Save As');
    selectMapNameWindow.contentElement.appendChild(form.elem());
    selectMapNameWindow.onok = () => applyCallback(input.value);
  }
  return selectMapNameWindow;
}

export function showMapNameSelection(injector: Injector, defaultName: string): Promise<string> {
  return new Promise(async resolve => {
    const win = await getWindow(injector);
    setDefaultName(defaultName);
    win.onclose = () => resolve(null);
    applyCallback = (name: string) => { win.hide(); resolve(name); }
    win.show();
  })
}
