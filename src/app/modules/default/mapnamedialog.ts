import { Dependency, lifecycle } from "../../../utils/injector";
import { tag } from '../../../utils/ui/ui';
import { PhotonDialog } from "../photonui";

export const MAP_NAME = new Dependency<(name: string) => Promise<string>>('MapName');

export const DefaultMapName = lifecycle(async (injector, lifecycle) => {
  const input = <HTMLInputElement>tag('input')
    .attr('type', 'text')
    .attr('placeholder', 'Map Name')
    .className('form-control').elem();
  const label = tag('label').text('File Name:');
  const form = tag('form').css('padding', '10px 10px 5px 10px').css('width', '400px')
    .append(tag('div').className('form-group').append(label).appendHtml(input));
  form.elem().onkeydown = e => { if (e.key == 'Enter') e.preventDefault() };

  const selectMapNameWindow = new PhotonDialog('Save As');
  selectMapNameWindow.contentElement.appendChild(form.elem());
  selectMapNameWindow.hide();
  lifecycle(selectMapNameWindow, async s => s.destroy())

  return (name: string) => new Promise((resolve: (s: string) => void) => {
    input.value = name;
    selectMapNameWindow.onok = () => { selectMapNameWindow.hide(); resolve(input.value) };
    selectMapNameWindow.onclose = () => resolve(null);
    selectMapNameWindow.show();
  });
});
