import { createActionItem } from "@ui/action-list";
import { Row } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { Source, ValuesContainer, ValuesMap } from "@utils/callbacks";
import { iter } from "@utils/iter";
import { MultiFunction, pair } from "@utils/types";
import { EngineContext } from "app/apis/engine";
import { FileSystem, FileSystemHandle, SerializedFileSystemHandle } from "app/apis/fs";
import Optional from "optional-js";
import React, { ReactNode } from "react";
import { createEngineContextWork as createEngineBlood } from "../blood/blood";
import { createEngineContextEduke32, Eduke32ModsType, GrpInfo, loadGrpInfo1 } from "../eduke32/eduke32";
import { stack } from "../fs/fs";
import { Work } from "../scheduler/work";

export type EngineContextRecord = {
  name: string,
  type: string,
  fileSystems: SerializedFileSystemHandle[],
  mods: Object,
}

export type EngineContextType<T> = {
  id: string,
  name: string,
  factory: Work<[Source<FileSystem>, T], [EngineContext]>,
  defaultMods: T,
  modsEditor: MultiFunction<[ValuesMap<T>, Source<FileSystemHandle[]>, ValuesContainer], ReactNode>
}

function loadGrpFiles(fss: FileSystemHandle[]): Promise<[string, Optional<GrpInfo>][]> {
  return iter(fss)
    .map(f => f.open())
    .await_()
    .then(fss => fss
      .map(f => f.unwrap())
      .reduceFirst(stack)
      .map(fs => fs.list()
        .then(list => iter(list)
          .map(f => f.name)
          .filter(n => n.toLowerCase().endsWith('.grp'))
          .map(n => n.substring(0, n.length - 4))
          .map(async n => pair(n, await loadGrpInfo1(fs, n)))
          .await_())
        .then(i => i.collect()))
      .orElse(Promise.resolve([])));
}

function Eduke32Mods(mods: ValuesMap<Eduke32ModsType>, fsHandles: Source<FileSystemHandle[]>, values: ValuesContainer) {
  const grpName = mods.get('grpName');
  const openGrpFiles = values.value('openEngineType', false);
  const grpNameLabel = values.transformed('grpNameLabel', mods.get('grpName'), e => <div className="flex-fill">{e}</div>);
  const grpFiles = values.transformedAsyncImmediate('grpFiles', fsHandles, [], loadGrpFiles);
  const grpFileItems = values.transformedTuple('grpNameItems', [grpFiles, grpName], ([files, current]) => iter(files)
    .map(([name, info]) => createActionItem(<div>{`${name} ${info.map(i => ' - ' + i.name).orElse('')}`}</div>, () => grpName.set(name), false, current === name))
    .collect());
  return <Row className='flex-auto baseline-aligned gap-10'>
    <div style={{ flexBasis: '100px', textAlign: 'end' }}>Grp Name</div>
    <MenuButton openValue={openGrpFiles} labelAutoSize={false} label={grpNameLabel} items={grpFileItems} />
  </Row>
}

export const ENGINES: EngineContextType<any>[] = [
  { id: 'blood', name: 'Blood', factory: createEngineBlood, defaultMods: {}, modsEditor: _ => <></> },
  { id: 'eduke32', name: 'EDuke32', factory: createEngineContextEduke32(), defaultMods: { grpName: 'duke3d' }, modsEditor: Eduke32Mods } as EngineContextType<Eduke32ModsType>,
]