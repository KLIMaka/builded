import { ActionDescriptorsContext, ActionsChannelContext, ActionsNode, useValue } from "@ui/commons";
import { MessageBox } from "@ui/message-box";
import { Consumer } from "@utils/types";
import { TaskController } from "app/apis/app1";
import { Ui } from "app/apis/ui1";
import React, { useContext, useEffect } from "react";

function Progress<T>({ result, task }: { result: Consumer<T>, task: TaskController<T> }) {
  const actionsChannel = useContext(ActionsChannelContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const info = useValue(task.info);
  const propgress = useValue(task.progress);
  const paused = useValue(task.paused);

  useEffect(() => {
    const ctx = actionDescriptors.sub('progress-box');
    return actionsChannel.collector().add(
      ctx.bindSync('stop', () => task.stop()),
      ctx.bindSync('resume-pause', () => paused ? task.unpause() : task.pause()),
    );
  }, [actionDescriptors, actionsChannel, paused, task]);

  return (<div className='column-block'>
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

export async function waitFor<T>(channel: ActionsNode, ui: Ui, title: string, task: TaskController<T>, channelConsumer?: Consumer<ActionsNode>) {
  const window = await ui.showWindow(await MessageBox<T>({
    content: result => <Progress result={result} task={task} />,
    height: 170,
    width: 400,
    title: title,
    parentChannel: channel,
    channelConsumer,
    resultConsumer: _ => task.stop()
  }));
  const result = await task.end();
  window.winbox.winBoxObj?.close();
  return result;
}