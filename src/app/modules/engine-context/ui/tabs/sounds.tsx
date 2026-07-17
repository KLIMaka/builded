import { Sound } from "app/apis/engine";
import { FileInfo, FileSource } from "app/apis/fs";
import { Column, NonwrapLabel, Row, Spacer, useValue, useValuesContainer } from "app/modules/ui/commons";
import { column, singleSelectionModel, Sort, TypedTableCellProps, VirtualTable, VirtualTableColumn } from "app/modules/ui/table";
import { readVoc } from "build/formats/voc";
import Optional from "optional-js";
import React from "react";
import { match } from "ts-pattern";
import { Source } from "ts-utils/callbacks";
import { cookbook } from "ts-utils/cookbook";
import { sum } from "ts-utils/mathutils";
import { asyncFlatMapOptional } from "ts-utils/objects";
import { Scheduler, Task, TaskController, TaskValue } from "ts-utils/scheduler";
import { BiFn, notUndefined, result, resultAsync, Supplier } from "ts-utils/types";
import { EngineInfo } from "../engine-context";
import { FileNameRenderer, FileSizeRenderer, FilesSummary } from "./common";

type SoundFile = Readonly<{
  sound: Sound,
  file?: FileInfo
}>;

type SoundFileRow = Readonly<{
  id: number,
  alias?: string,
  name: string,
  size: number,
  volume: number,
  buffer: Supplier<TaskController<Optional<AudioBuffer>>>,
}>;

export function sortFunction(field: keyof SoundFileRow, dirG: number, dirL: number): BiFn<SoundFileRow, SoundFileRow, number> {
  return match(field)
    .returnType<BiFn<SoundFileRow, SoundFileRow, number>>()
    .with('name', f => (l, r) => l[f].toLowerCase() < r[f].toLowerCase() ? dirG : dirL)
    .otherwise(f => (l, r) => (l[f] ?? 0) < (r[f] ?? 0) ? dirG : dirL)
}

function SoundIdRenderer({ cellData }: TypedTableCellProps<SoundFileRow, number>) {
  return <div className='row-block baseline-aligned gap-5'><NonwrapLabel label={cellData} /></div>
}

function Duration(props: { src: Source<TaskValue<Optional<AudioBuffer>>> }) {
  const buffer = useValue(props.src);
  return <div className="text-align-right">{buffer.on(b => b.unwrap().map(b => `${b.duration.toFixed(2)}s`).orElse('0s'), _ => '')}</div>
}

function SampleRate(props: { src: Source<TaskValue<Optional<AudioBuffer>>> }) {
  const buffer = useValue(props.src);
  return <div className="text-align-right">{buffer.on(b => b.unwrap().map(b => `${(b.sampleRate / 1000).toFixed()}KHz`).orElse('0KHz'), _ => '')}</div>
}


export function FileRateRenderer({ cellData }: TypedTableCellProps<SoundFileRow, number>) {
  return <div className="text-align-right">{`${((cellData ?? 0) / 1000).toFixed()}KHz`}</div>
}

export function FileVolumeRenderer({ cellData }: TypedTableCellProps<SoundFileRow, number>) {
  return <div className="text-align-right">{`${((cellData ?? 0) * 100).toFixed()}%`}</div>
}

const AUDIO_CTX = new AudioContext();
const GAIN_NODE = AUDIO_CTX.createGain();
GAIN_NODE.connect(AUDIO_CTX.destination);

function uint8AudioBuffer(buff: Uint8Array, sampleRate: number) {
  const buffer = AUDIO_CTX.createBuffer(1, buff.byteLength, sampleRate);
  const channelData = buffer.getChannelData(0);
  buff.forEach((x, i) => channelData[i] = (x - 128) / 128);
  return buffer;
}

function int16AudioBuffer(buff: Int16Array, sampleRate: number) {
  const buffer = AUDIO_CTX.createBuffer(1, buff.byteLength, sampleRate);
  const channelData = buffer.getChannelData(0);
  buff.forEach((x, i) => channelData[i] = x / 32768);
  return buffer;
}

async function getData(buff: ArrayBuffer, name: string, sampleRate: number): Promise<Optional<AudioBuffer>> {
  if (name.endsWith('.raw'))
    return Optional.of(uint8AudioBuffer(new Uint8Array(buff), sampleRate));
  const voc = result(() => match(readVoc(buff))
    .with({ type: '8' }, voc => uint8AudioBuffer(voc.data, voc.sampleRate))
    .with({ type: '16' }, voc => int16AudioBuffer(voc.data, voc.sampleRate))
    .exhaustive());
  if (voc.isOk()) return voc.optional();
  const decoded = await resultAsync(() => AUDIO_CTX.decodeAudioData(buff));
  return decoded.optional();
}

async function play(row: SoundFileRow): Promise<void> {
  (await row.buffer().end()).unwrap().ifPresent(async buffer => {
    const sound = AUDIO_CTX.createBufferSource();
    sound.buffer = buffer;
    sound.connect(GAIN_NODE);
    sound.start();
  })
}

const soundsColumns: VirtualTableColumn<SoundFileRow, any>[] = [
  column('id', "Id", SoundIdRenderer, 30),
  column('name', "File", FileNameRenderer, 0, 1, 1),
  column('alias', "Alias", FileNameRenderer, 0, 1, 1),
  // column('volume', "Volume", FileVolumeRenderer, 60),
  column('buffer', "Lenght", ({ cellData }) => <Duration src={notUndefined(cellData)().task} />, 60),
  column('buffer', "Rate", ({ cellData }) => <SampleRate src={notUndefined(cellData)().task} />, 60),
  column('size', "Size", FileSizeRenderer, 60),
];

function loadAudioBuffer(src: FileSource, name: string, sampleRate: number): Task<Optional<AudioBuffer>> {
  return cookbook(book => {
    const file = book.recepie('Loading file', [], async () => src.read(name));
    return book.recepie('Decoding buffer', [file], file => asyncFlatMapOptional(file, buff => getData(buff, name, sampleRate)));
  });
}

export function SoundsInfoView({ info, scheduler }: { info: EngineInfo, scheduler: Scheduler }) {
  const emptyBuffer = scheduler.exec(async h => Optional.empty<AudioBuffer>());
  const values = useValuesContainer(`sounds`);
  const soundFiles = values.transformedTuple('sound-files', [info.ctx.sounds, info.filesMap], ([sounds, map]) =>
    sounds.map<SoundFile>(sound => ({ sound, file: map.get(sound.file.toLowerCase()) })));
  const soundBufferCache = values.value('buffer-cache', new Map<string, TaskController<Optional<AudioBuffer>>>());
  const soundsFileRows = values.transformedTuple('sound-file-rows', [soundFiles, soundBufferCache], ([sfs, cache]) => sfs.map<SoundFileRow>(sf => ({
    id: sf.sound.id,
    alias: sf.sound.alias,
    name: sf.sound.file,
    size: sf.file?.size ?? 0,
    lenght: (sf.file?.size ?? 0) / sf.sound.sampleRate,
    volume: sf.sound.volume,
    buffer: () => cache.getOrInsertComputed(sf.sound.file, _ => Optional.ofNullable(sf.file)
      .map(f => scheduler.exec(loadAudioBuffer(f.src, sf.sound.file, sf.sound.sampleRate)))
      .orElse(emptyBuffer))
  })));
  const sort = values.value<Sort<SoundFileRow>>('sort', { column: 'id', direction: "ASC" });
  const sortedRows = values.transformedTuple('sorted-rows', [soundsFileRows, sort], ([rows, sort]) => {
    const sortColumn = sort.column;
    if (sortColumn === undefined) return rows;
    const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
    return rows.toSorted(sortFunction(sortColumn, dirG, dirL));
  });
  const count = values.transformed('count', soundFiles, files => files.length);
  const size = values.transformed('size', soundsFileRows, files => files.map(m => m.size).reduce(sum, 0));

  return <Column className='form-panel gap-5'>
    <Row className="flex-auto">
      <Spacer />
    </Row>
    <Row className="flex-fill">
      <VirtualTable
        columns={soundsColumns}
        rows={sortedRows}
        selected={singleSelectionModel(values, sortedRows)}
        sort={sort}
        onDubleClick={i => play(i)}
      />
    </Row>
    <FilesSummary filesCount={count} filesSize={size} />
  </Column>
}