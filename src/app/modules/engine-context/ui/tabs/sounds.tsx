import { Sound } from "app/apis/engine";
import { FileInfo, FileSource } from "app/apis/fs";
import { Column, NonwrapLabel, Row, Spacer, useValuesContainer } from "app/modules/ui/commons";
import { column, singleSelectionModel, Sort, TypedTableCellProps, VirtualTable, VirtualTableColumn } from "app/modules/ui/table";
import { readVoc } from "build/formats/voc";
import React from "react";
import { match } from "ts-pattern";
import { sum } from "ts-utils/mathutils";
import { BiFn, result, resultAsync } from "ts-utils/types";
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
  lenght: number,
  sampleRate: number,
  volume: number,
  src?: FileSource,
  soundFile: SoundFile,
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

export function FileLengthRenderer({ cellData }: TypedTableCellProps<SoundFileRow, number>) {
  return <div className="text-align-right">{`${cellData?.toFixed(2)}s`}</div>
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

type SoundData = {
  data: Uint8Array,
  sampleRate: number
}

function uint8AudioNode(buff: Uint8Array, sampleRate: number) {
  const buffer = AUDIO_CTX.createBuffer(1, buff.byteLength, sampleRate);
  const channelData = buffer.getChannelData(0);
  buff.forEach((x, i) => channelData[i] = (x - 128) / 128);
  const source = AUDIO_CTX.createBufferSource();
  source.buffer = buffer;
  return source;
}

function uint16AudioNode(buff: Int16Array, sampleRate: number) {
  const buffer = AUDIO_CTX.createBuffer(1, buff.byteLength, sampleRate);
  const channelData = buffer.getChannelData(0);
  buff.forEach((x, i) => channelData[i] = x / 32768);
  const source = AUDIO_CTX.createBufferSource();
  source.buffer = buffer;
  return source;
}

async function getData(buff: ArrayBuffer, row: SoundFileRow): Promise<AudioBufferSourceNode> {
  const name = row.name.toLowerCase();
  if (name.endsWith('.raw')) {
    return uint8AudioNode(new Uint8Array(buff), row.sampleRate);
  }
  const voc = result(() => {
    const voc = readVoc(buff);
    if (voc.type === '8') return uint8AudioNode(voc.data, voc.sampleRate);
    else return uint16AudioNode(voc.data, voc.sampleRate);
  });
  if (voc.isOk()) return voc.getOk();
  const decoded = await resultAsync(async () => {
    const buffer = await AUDIO_CTX.decodeAudioData(buff);
    const source = AUDIO_CTX.createBufferSource();
    source.buffer = buffer;
    return source;
  });
  return decoded.unwrap();

}

async function play(row: SoundFileRow): Promise<void> {
  (await row.soundFile.file?.src.read(row.soundFile.file.name))?.ifPresent(async data => {
    const sound = await getData(data, row);
    sound.connect(GAIN_NODE);
    sound.start();
  })
}

const soundsColumns: VirtualTableColumn<SoundFileRow, any>[] = [
  column('id', "Id", SoundIdRenderer, 60),
  column('name', "File", FileNameRenderer, 0, 1, 1),
  column('alias', "Alias", FileNameRenderer, 0, 1, 1),
  // column('volume', "Volume", FileVolumeRenderer, 60),
  column('lenght', "Lenght", FileLengthRenderer, 60),
  // column('sampleRate', "Rate", FileRateRenderer, 60),
  column('size', "Size", FileSizeRenderer, 60),
];

export function SoundsInfoView({ info }: { info: EngineInfo }) {
  const values = useValuesContainer(`sounds`);
  const soundFiles = values.transformedTuple('sound-files', [info.ctx.sounds, info.filesMap], ([sounds, map]) =>
    sounds.map<SoundFile>(sound => ({ sound, file: map.get(sound.file.toLowerCase()) })));
  const soundsFileRows = values.transformed('sound-file-rows', soundFiles, sfs => sfs.map<SoundFileRow>(sf => ({
    id: sf.sound.id,
    alias: sf.sound.alias,
    name: sf.sound.file,
    size: sf.file?.size ?? 0,
    soundFile: sf,
    sampleRate: sf.sound.sampleRate,
    lenght: (sf.file?.size ?? 0) / sf.sound.sampleRate,
    src: sf.file?.src,
    volume: sf.sound.volume,
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