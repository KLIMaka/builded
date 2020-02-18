import { Injector } from "../../utils/injector";
import { Table, span, dragElement } from "../../utils/ui/ui";
import { FS } from "./fs/fs";

export async function showFileBrowser(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const files = await fs.list();
  const infos = await Promise.all(files.map(f => fs.info(f)));
  const win = document.getElementById('files');
  dragElement(document.getElementById('files_title'), win);
  win.classList.remove('hidden');
  document.getElementById('files_close').addEventListener('click', _ => win.classList.add('hidden'));
  document.getElementById('files_content').removeChild(document.getElementById('files_table'));
  const table = new Table();
  table.className("table-striped");
  table.id("files_table");
  infos.forEach(i => {
    table.row([span().text(i.name), span().text(i.size + ''), span().text(i.source)]);
  })
  document.getElementById('files_content').appendChild(table.elem());
}