import { Consumer, Function } from "@utils/types";
import { Ui, Window, WindowRenderer } from "app/apis/ui1";
import Optional from "optional-js";
import React, { ReactElement, useCallback, useContext, useEffect, useRef } from "react";
import WinBox from "react-winbox";
import { ActionDescriptorsContext, CurrentActionsChannelContext, ActionsChannelContext, ActionsNode } from "./commons";

export type MessageBoxProps<R> = {
  title: string,
  width: number,
  height: number,
  content: Function<Consumer<R>, ReactElement>,
  resultConsumer: Consumer<Optional<R>>,
  parentChannel: ActionsNode,
  channelConsumer?: Consumer<ActionsNode>
}

function MessageBoxImpl<R>(props: MessageBoxProps<R> & { onClose: Consumer<void>, windowConsumer: Consumer<Window> }) {
  const currentActions = useContext(CurrentActionsChannelContext);
  const actionsChannel = props.parentChannel;
  const channel = actionsChannel.child('message-box', true);
  const winRef = useRef<WinBox>();

  const handleClose = useCallback((result: Optional<R>) => {
    if (winRef.current) {
      currentActions(props.parentChannel);
      winRef.current.hide();
      props.onClose();
      props.resultConsumer(result);
    }
  }, [currentActions, props]);
  const handleCloseEmpty = useCallback(() => handleClose(Optional.empty()), [handleClose]);


  useEffect(() => {
    props.channelConsumer?.(channel);
    props.windowConsumer({ winbox: winRef.current })
  }, [channel, props]);

  return (
    <ActionsChannelContext.Provider value={channel}>
      <WinBox
        ref={winRef}
        modal={true}
        title={props.title}
        className="window"
        x='center'
        y='center'
        noFull={true}
        width={props.width}
        height={props.height}
        onClose={handleCloseEmpty}
        onFocus={() => currentActions(channel)}
      >
        {props.content(r => handleClose(Optional.ofNullable(r)))}
      </WinBox>
    </ActionsChannelContext.Provider>);
}


export async function MessageBox<R>(props: MessageBoxProps<R>): Promise<WindowRenderer> {
  return (onClose: Consumer<void>, windowConsumer: Consumer<Window>) => <MessageBoxImpl<R> {...props} onClose={onClose} windowConsumer={windowConsumer} />
}

function ConfirmOkCancel({ result, text, icon }: { result: Consumer<boolean>, text: string, icon: string }) {
  const actionsChannel = useContext(ActionsChannelContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);

  useEffect(() => {
    const ctx = actionDescriptors.sub('message-box');
    return actionsChannel.collector().add(
      ctx.bindSync('ok', () => result(true)),
      ctx.bindSync('cancel', () => result(false)),
    );
  }, [actionDescriptors, actionsChannel, result]);

  return <div className='column-block'>
    <div className='flex-fill row-block'>
      <div className={`fa-folid fa ${icon} padded-10`} style={{ fontSize: 32, alignContent: 'center' }} />
      <div className='padded-10 flex-fill' style={{ alignContent: 'center' }}>{text}</div>
    </div>
    <div className='row-block gap-5 flex-auto padded-10'>
      <div className='flex-fill' />
      <div className='button flex-auto default' style={{ width: '60px', textAlign: 'center' }} onClick={() => result(true)}>OK</div>
      <div className='button flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => result(false)}>Cancel</div>
    </div>
  </div>
}

export function confirm(actionsChannel: ActionsNode, ui: Ui, title: string, text: string): Promise<Optional<boolean>> {
  return new Promise<Optional<boolean>>(async (ok, error) => {
    ui.showWindow(await MessageBox<boolean>({
      content: result => <ConfirmOkCancel result={result} text={text} icon='fa-triangle-exclamation' />,
      resultConsumer: ok,
      height: 150,
      width: 300,
      title: title,
      parentChannel: actionsChannel
    }));
  })
}

function Info({ result, text, icon }: { result: Consumer<void>, text: string, icon: string }) {
  const actionsChannel = useContext(ActionsChannelContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);

  useEffect(() => {
    const ctx = actionDescriptors.sub('message-box');
    return actionsChannel.collector().add(
      ctx.bindSync('ok', () => result()),
      ctx.bindSync('cancel', () => result()),
    );
  }, [actionDescriptors, actionsChannel, result]);

  return <div className='column-block'>
    <div className='flex-fill row-block'>
      <div className={`fa-folid fa ${icon} padded-10`} style={{ fontSize: 32, alignContent: 'center' }} />
      <div className='padded-10 flex-fill' style={{ alignContent: 'center' }}>{text}</div>
    </div>
    <div className='row-block gap-5 flex-auto padded-10'>
      <div className='flex-fill' />
      <div className='button flex-auto default' style={{ width: '60px', textAlign: 'center' }} onClick={_ => result()}>OK</div>
    </div>
  </div>
}

export function info(actionsChannel: ActionsNode, ui: Ui, title: string, text: string): Promise<void> {
  return new Promise<void>(async ok => {
    ui.showWindow(await MessageBox<void>({
      content: result => <Info result={result} text={text} icon='' />,
      resultConsumer: _ => ok(),
      height: 150,
      width: 300,
      title: title,
      parentChannel: actionsChannel
    }));
  })
}