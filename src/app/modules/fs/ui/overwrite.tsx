import { ActionDescriptorsContext, ActionsChannelContext, ActionsNode } from "@ui/commons";
import { MessageBox } from "@ui/message-box";
import { Consumer } from "@utils/types";
import { Ui } from "app/apis/ui1";
import Optional from "optional-js";
import React from "react";
import { useContext, useEffect } from "react";

export type OverwriteOption = 'yes' | 'no' | 'all-yes' | 'all-no';

export function ConfirmOkCancel({ result, text, icon }: { result: Consumer<OverwriteOption>, text: string, icon: string }) {
  const actionsChannel = useContext(ActionsChannelContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);

  useEffect(() => {
    const ctx = actionDescriptors.sub('overwrite-box');
    return actionsChannel.collector().add(
      ctx.bindSync('yes', () => result('yes')),
      ctx.bindSync('no', () => result('no')),
      ctx.bindSync('all-yes', () => result('all-yes')),
      ctx.bindSync('all-no', () => result('all-no')),
    );
  }, [actionDescriptors, actionsChannel, result]);

  return <div className='column-block'>
    <div className='flex-fill row-block'>
      <div className={`fa-folid fa ${icon} padded-10`} style={{ fontSize: 32, alignContent: 'center' }} />
      <div className='padded-10 flex-fill' style={{ alignContent: 'center' }}>{text}</div>
    </div>
    <div className='row-block gap-5 flex-auto padded-10'>
      <div className='flex-fill' />
      <div className='button flex-auto default' style={{ width: '60px', textAlign: 'center' }} onClick={() => result('yes')}>Yes</div>
      <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => result('all-yes')}>Yes for all</div>
      <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => result('no')}>No</div>
      <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => result('all-no')}>No for all</div>
    </div>
  </div>
}

export function confirmOverwrite(actionsChannel: ActionsNode, ui: Ui, title: string, text: string): Promise<Optional<OverwriteOption>> {
  return new Promise<Optional<OverwriteOption>>(async (ok, error) => {
    ui.showWindow(await MessageBox<OverwriteOption>({
      content: result => <ConfirmOkCancel result={result} text={text} icon='fa-triangle-exclamation' />,
      resultConsumer: ok,
      height: 150,
      width: 450,
      title: title,
      parentChannel: actionsChannel
    }));
  })
}