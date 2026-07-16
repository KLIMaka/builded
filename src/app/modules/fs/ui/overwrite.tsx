import { modalResult, WindowBuilder } from "@ui/windows-common";
import { UiUtils } from "app/apis/ui";
import Optional from "optional-js";
import React from "react";
import { Consumer } from "ts-utils/types";

export type OverwriteOption = 'yes' | 'no' | 'all-yes' | 'all-no';

export function ConfirmOkCancel({ result, text, icon }: { result: Consumer<OverwriteOption>, text: string, icon: string }) {
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

export function confirmOverwrite(uiUtils: UiUtils, title: string, text: string): Promise<Optional<OverwriteOption>> {
  const localValues = uiUtils.values.create('override-box');
  return new Promise<Optional<OverwriteOption>>(async (ok, error) => {
    const [resultAndClose, close] = modalResult(() => window.close(), ok);
    const window = new WindowBuilder('overwrite-box', uiUtils.actionDescriptors, localValues)
      .modal()
      .title(title)
      .size(450, 150)
      .action('yes', () => resultAndClose('yes'))
      .action('no', () => resultAndClose('no'))
      .action('all-yes', () => resultAndClose('all-yes'))
      .action('all-no', () => resultAndClose('all-no'))
      .onClose(close)
      .disposable(localValues)
      .build(<ConfirmOkCancel result={resultAndClose} text={text} icon='fa-triangle-exclamation' />)
    uiUtils.ui.addWindow(window);
  });
}