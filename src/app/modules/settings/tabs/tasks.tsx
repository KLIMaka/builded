import { Column, Icon, ProgressBar, Row, useValue, useValuesContainer } from "@ui/commons";
import { TypedTableCellProps, VirtualTable, column, row, singleSelectionModel, textCellString } from "@ui/table";
import React from "react";
import { Source } from "ts-utils/callbacks";
import { TaskController } from "ts-utils/scheduler";
import { notUndefined } from "ts-utils/types";

function TaskProgress(props: { task: TaskController<any> }) {
  const paused = useValue(props.task.paused);
  return <Row className="flex-fill baseline-aligned gap-5 padded-10h">
    <ProgressBar progress={props.task.progress} info={props.task.info} />
    {paused ? <Icon icon="play" onClick={() => props.task.unpause()} /> : <Icon icon="pause" onClick={() => props.task.pause()} />}
    <Icon icon="stop" onClick={() => props.task.stop()} />
  </Row >
}

function ProgressColumn({ cellData }: TypedTableCellProps<TaskController<any>, TaskController<any>>) {
  const data = notUndefined(cellData);
  return <TaskProgress task={data} />
}


export function TasksView(props: { tasks: Source<TaskController<any>[]> }) {
  const values = useValuesContainer('values-view');

  return <Column className="form-panel flex-fill padded-5">
    <Row className="flex-auto"></Row>
    <VirtualTable
      disableHeader
      rows={props.tasks}
      rowHeight={24}
      columns={[
        column('name', 'Name', textCellString<TaskController<any>>(), 200),
        row('propgress', 'Progress', ProgressColumn, 0, 1, 1)
      ]}
      selected={singleSelectionModel(values, props.tasks)}
    />
  </Column>
}