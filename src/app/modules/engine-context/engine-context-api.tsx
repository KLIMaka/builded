import { createActionItem } from "@ui/action-list";
import { Check } from "@ui/check-button";
import { Row } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { EngineContext } from "app/apis/engine";
import { FileSystem, FileSystemHandle, SerializedFileSystemHandle } from "app/apis/fs";
import Optional from "optional-js";
import React, { ReactNode } from "react";
import { initial, Source, TRANSFORM_PLACEHOLDER, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { MultiFn } from "ts-utils/types";
import { Work } from "ts-utils/work";
import { createEngineContextWork as createEngineBlood } from "../blood/blood";
import { GrpInfo } from "../eduke32/defs";
import { createEngineContextEduke32, Eduke32ModsType, loadGrpInfoFile } from "../eduke32/eduke32";
import { stack } from "../fs/fs";
import { Board } from "build/board/structs";
import { Values } from "app/apis/values";

export type EngineContextRecord = {
  name: string,
  type: string,
  fileSystems: SerializedFileSystemHandle[],
  mods: object,
}

export type EngineContextType<T, B extends Board = Board> = {
  id: string,
  name: string,
  factory: Work<[Source<FileSystem>, ValuesContainer, T], [EngineContext<B>]>,
  defaultMods: T,
  modsEditor: MultiFn<[ValuesMap<T>, Source<FileSystemHandle[]>, ValuesContainer], ReactNode>
}

type GrpFileInfo = Readonly<{
  name: string,
  info: Optional<GrpInfo>,
}>

const EMPTY: GrpFileInfo = { name: '', info: Optional.empty() };

function loadGrpFiles(fss: FileSystemHandle[]): Promise<GrpFileInfo[]> {
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
          .map(async name => ({ name, info: await loadGrpInfoFile(name, await fs.read(name)) }))
          .await_())
        .then(i => i.collect()))
      .orElse(Promise.resolve([])))
    .then(files => [EMPTY, ...files]);
}

function getGrpNameLabel(name: string) {
  return name === '' ? '{NONE}' : name;
}

function Eduke32Mods(mods: ValuesMap<Eduke32ModsType>, fsHandles: Source<FileSystemHandle[]>, values: ValuesContainer) {
  const grpName = mods.get('grpName');
  const openGrpFiles = values.value('grpName', false);
  const grpNameLabel = values.transformed('grpNameLabel', mods.get('grpName'), e => <div className="flex-fill">{getGrpNameLabel(e)}</div>);
  const grpFiles = values.transformedAsyncBuilder({ name: 'grpFiles', source: fsHandles, transformer: loadGrpFiles, initialValue: initial<GrpFileInfo[]>([EMPTY]) });
  const grpFileItems = values.transformedTuple('grpNameItems', [grpFiles, grpName], ([files, current]) => iter(files === TRANSFORM_PLACEHOLDER ? [] : files)
    .map(({ name, info }) => createActionItem(<div>{`${getGrpNameLabel(name)} ${info.map(i => ' - ' + (i.name ?? '')).orElse('')}`}</div>, () => grpName.set(name), false, current === name))
    .collect());
  return <>
    <Row className='flex-auto baseline-aligned gap-10'>
      <div style={{ flexBasis: '100px', textAlign: 'end' }}>Grp Name</div>
      <MenuButton openValue={openGrpFiles} labelAutoSize={false} label={grpNameLabel} items={grpFileItems} />
    </Row>
    <Row className='flex-auto baseline-aligned gap-10'>
      <div style={{ flexBasis: '100px', textAlign: 'end' }}></div>
      <Check label='Main GRP First' value={mods.get('mainGrpFirst')} />
    </Row>
  </>
}

export const ENGINES: EngineContextType<any, any>[] = [
  { id: 'blood', name: 'Blood', factory: createEngineBlood, defaultMods: {}, modsEditor: _ => <></> },
  { id: 'eduke32', name: 'EDuke32', factory: createEngineContextEduke32, defaultMods: { grpName: '', mainGrpFirst: false }, modsEditor: Eduke32Mods } as EngineContextType<Eduke32ModsType>,
]