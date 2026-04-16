import { ActionDescriptors } from "app/apis/actions";
import { App } from "app/apis/app";
import { Ui } from "app/apis/ui";
import { Values } from "app/apis/values";
import Optional from "optional-js";
import React, { useContext, useEffect, useRef } from "react";
import { Source, Value } from "ts-utils/callbacks";
import { Consumer } from "ts-utils/types";
import { ActionsChannelContext, Button, Column, Icon, Row, Spacer, UiContext, useValue } from "./commons";
import { modalResult, WindowBuilder } from "./windows-common";

function ConfirmOkCancel({ result, text, icon }: { result: Consumer<boolean>, text: string, icon: string }) {
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

export function confirm(ui: Ui, actionDescriptors: ActionDescriptors, values: Values, title: string, text: string): Promise<Optional<boolean>> {
  const localvalues = values.create('confirm-box');
  return new Promise<Optional<boolean>>(async result => {
    const [resultAndClose, close] = modalResult(() => window.close(), result);
    const window = new WindowBuilder('message-box', actionDescriptors, localvalues)
      .modal()
      .title(title)
      .size(300, 150)
      .action('ok', () => resultAndClose(true))
      .action('cancel', () => resultAndClose(false))
      .onClose(close)
      .disposable(localvalues)
      .build(<ConfirmOkCancel result={resultAndClose} text={text} icon='fa-triangle-exclamation' />);
    ui.addWindow(window);
  })
}

function Info({ result, text, icon }: { result: Consumer<void>, text: string, icon: string }) {
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

export function info(ui: Ui, actionDescriptors: ActionDescriptors, values: Values, title: string, text: string, icon = 'fa-triangle-exclamation'): Promise<Optional<void>> {
  const localValues = values.create('info-box');
  return new Promise<Optional<void>>(async result => {
    const [resultAndClose, close] = modalResult(() => window.close(), result);
    const window = new WindowBuilder('message-box', actionDescriptors, localValues)
      .modal()
      .title(title)
      .size(300, 150)
      .action('ok', resultAndClose)
      .action('cancel', resultAndClose)
      .onClose(close)
      .disposable(localValues)
      .build(<Info result={resultAndClose} text={text} icon={icon} />);
    ui.addWindow(window)
  });
}

function InputText(props: { result: Consumer<boolean>, text: string, icon: string, value: Value<string>, isValid: Source<boolean> }) {
  const { actionDescriptors, currentActions } = useContext(UiContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const searchChannel = actionsChannel.child('input-text-box', true);

  const ref = useRef<HTMLInputElement>(null);
  const value = useValue(props.value);
  const isValid = useValue(props.isValid);
  useEffect(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    ref.current?.focus()
    return searchChannel.collector().add(
      ctx.bindSync('close', () => props.result(false)),
      ctx.bindSync('enter', () => props.result(true))
    )
  }, [actionDescriptors, props, searchChannel]);

  return <ActionsChannelContext.Provider value={searchChannel}>
    <Column className='gap-10 padded-10'>
      <Row className="gap-10">
        <Icon icon={props.icon} className='padded-10' style={{ fontSize: 32, alignContent: 'center' }} />
        <Column className='flex-fill baseline-aligned gap-10'>
          <div className='flex-auto'>{props.text}</div>
          <Row className='flex-auto' style={{ alignSelf: 'stretch' }}>
            <div className="text-box flex-fill">
              <input
                className="flex-fill"
                ref={ref}
                type="text"
                value={value}
                onChange={e => props.value.set(e.target.value)}
                onFocus={_ => currentActions(searchChannel)}
                onBlur={_ => currentActions(actionsChannel)}
              />
            </div>
          </Row>
        </Column>
      </Row>
      <Row className='gap-10 flex-auto'>
        <Spacer />
        <Button
          className={`flex-auto ${isValid ? 'default' : 'disabled'}`}
          style={{ width: '60px', textAlign: 'center' }}
          onClick={() => isValid ? props.result(true) : 0}>
          <div>OK</div>
        </Button>
        <Button className='flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => props.result(false)}>Cancel</Button>
      </Row>
    </Column>
  </ActionsChannelContext.Provider>
}

export function inputText(app: App, ui: Ui, actionDescriptors: ActionDescriptors, values: Values, title: string, text: string, icon: string, def?: string, width?: number, height?: number): Promise<Optional<string>> {
  const ID = 'input-text-box';
  const localValues = values.create(ID);
  const value = localValues.value('value', def ?? '');
  const isValid = localValues.transformed('isValid', value, v => v.length > 0);
  return new Promise<Optional<string>>(async ok => {
    const [resultAndClose, close] = modalResult(() => window.close(), ok);
    const result = (isOk: boolean) => isOk ? resultAndClose(value.get()) : resultAndClose(null);

    const window = new WindowBuilder(ID, actionDescriptors, localValues)
      .modal()
      .title(title)
      .size(width ?? 300, height ?? 150)
      .action('ok', () => result(true), isValid)
      .action('cancel', () => result(false))
      .onClose(close)
      .disposable(localValues)
      .build(<InputText
        result={result}
        text={text}
        icon={icon}
        value={value}
        isValid={isValid}
      />);
    ui.addWindow(window)
  });
}