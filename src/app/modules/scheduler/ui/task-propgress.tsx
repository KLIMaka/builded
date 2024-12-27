import { useValue } from "@ui/commons";
import { WindowBuilder } from "@ui/windows-common";
import { createContainer } from "@utils/callbacks";
import { ActionDescriptors } from "app/apis/actions";
import { TaskController } from "app/apis/app1";
import { Ui } from "app/apis/ui1";
import React from "react";

function Progress<T>({ task }: { task: TaskController<T> }) {
  const info = useValue(task.info);
  const propgress = useValue(task.progress);
  const paused = useValue(task.paused);

  return (<div className='column-block flex-nonwrap'>
    <div className='flex-fill row-block'>
      <div className="flex-auto padded-10 fa-solid fa-file" style={{ fontSize: '32px', alignContent: 'center' }}></div>
      <div className="flex-fill" style={{ alignContent: 'center' }}>{info}</div>
    </div>
    <div className='flex-auto row-block padded-10'>
      <div className="flex-fill progress-bar-container">
        <div className="progress-bar" style={{ width: `${propgress}%` }} />
      </div>
    </div>
    <div className='row-block gap-5 flex-auto padded-10'>
      <div className='flex-fill' />
      {paused
        ? <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => task.unpause()}>Resume</div>
        : <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => task.pause()}>Pause</div>}
      <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => task.stop()}>Cancel</div>
    </div>
  </div>);
}

export async function waitFor<T>(ui: Ui, actionDescriptors: ActionDescriptors, title: string, task: TaskController<T>) {
  const values = createContainer('task-window');
  const window = new WindowBuilder('progress-box', actionDescriptors, values)
    .modal()
    .title(title)
    .size(400, 170)
    .action('stop', () => task.stop())
    .action('resume-pause', () => task.paused.get() ? task.unpause() : task.pause())
    .onClose(() => task.stop())
    .disposable(values)
    .build(<Progress task={task} />);
  ui.addWindow(window);
  await window.show();
  const result = await task.end();
  await window.close();
  return result;
}