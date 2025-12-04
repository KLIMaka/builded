import { Column, Row, useValuesContainer } from "@ui/commons";
import { TypedTableCellProps, VirtualTable, row, singleSelectionModel } from "@ui/table";
import { GlContext } from "@utils/gl/drawstruct";
import React from "react";
import { notUndefined } from "ts-utils/types";



export function GlView(props: { glCtx: GlContext }) {
  const localValues = useValuesContainer('gl-view');
  const resources = localValues.transformed('resources', props.glCtx.resourcesInfo, info => [...info.entries()]);
  const rowRenderer = ({ cellData }: TypedTableCellProps<[string, number], [string, number]>) => {
    const data = notUndefined(cellData);
    return <Row className="baseline-aligned gap-10">{data[0]}:{data[1]}</Row>
  }
  return <Column className="form-panel flex-fill padded-5">
    <Row className="flex-auto"></Row>
    <VirtualTable
      disableHeader
      rows={resources}
      columns={[
        row('row', 'Name', rowRenderer, 0, 1, 1)
      ]}
      selected={singleSelectionModel(localValues, resources)}
    />
  </Column>
}