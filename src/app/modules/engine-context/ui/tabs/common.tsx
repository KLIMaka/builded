import { FileInfo, FileSource } from "app/apis/fs";
import { match } from "ts-pattern";
import { BiFn } from "ts-utils/types";
import React from "react";
import { fsIcon } from "app/modules/fs/ui/fs-ui-utils";
import { Icon, NonwrapLabel, Row, Spacer, useValue } from "app/modules/ui/commons";
import { TypedTableCellProps } from "app/modules/ui/table";
import { size } from "ts-utils/size";
import { Source } from "ts-utils/callbacks";

export function sortFunction(field: keyof FileInfo, dirG: number, dirL: number): BiFn<FileInfo, FileInfo, number> {
  return match(field)
    .returnType<BiFn<FileInfo, FileInfo, number>>()
    .with('lastModified', 'size', f => (l, r) => l[f] < r[f] ? dirG : dirL)
    .with('name', f => (l, r) => l[f].toLowerCase() < r[f].toLowerCase() ? dirG : dirL)
    .with('src', f => (l, r) => l[f].name.toLowerCase() < r[f].name.toLowerCase() ? dirG : dirL)
    .exhaustive()
}

export function FileNameRenderer<T>({ cellData }: TypedTableCellProps<T, string>) {
  return (<div className='row-block baseline-aligned gap-5'>
    <Icon icon='file' />
    <NonwrapLabel label={cellData} />
  </div>)
}

export function FileSizeRenderer<T>({ cellData }: TypedTableCellProps<T, number>) {
  return <div className="text-align-right">{size(cellData ?? 0)}</div>
}

export function FileSourceRenderer<T>({ cellData }: TypedTableCellProps<T, FileSource>) {
  return <Row className="baseline-aligned gap-5">
    <Icon icon={fsIcon(cellData?.type)} className='fa-fixwidth' />
    <NonwrapLabel label={cellData?.name} />
  </Row>
}

export function FilesSummary(props: { filesCount: Source<number>, filesSize: Source<number> }) {
  const count = useValue(props.filesCount);
  const mapsSize = useValue(props.filesSize);

  return <Row className="flex-auto">
    <Spacer />
    Total: {count} Size: {size(mapsSize)}
  </Row>
}
