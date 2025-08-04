import { Icon, styles, useValue } from "@ui/commons";
import { Aliases, ArtInfoExtended, EMPTY_INFO_EXTENDED, NamedArtFile } from "app/apis/engine";
import { AnimationType } from "build/formats/art";
import Optional from "optional-js";
import React, { createContext, useContext, useEffect, useRef } from "react";
import { AutoSizer, Grid, GridCellRenderer } from "react-virtualized";
import { Source, Value } from "ts-utils/callbacks";
import { getOrDefault } from "ts-utils/collections";
import { int } from "ts-utils/mathutils";
import { Consumer, seq } from "ts-utils/types";

export type ArtEditor = {
  artInfos: Source<Map<number, ArtInfoExtended>>;
  art: Source<NamedArtFile[]>;
  currentId: Source<number>;
  aliases: Source<Aliases>;
  picnums: Source<number[]>;
  previewSize: Source<number>;
  previewGridSize: Value<Optional<[number, number]>>;
  setCurrentId(picnum: number): void;
  getArt(picnum: number): Source<string>;
  clickOnPicnum(picnum: number, doubleClick?: boolean): void;
};

export const ArtEditorContext = createContext<ArtEditor>(null);

export function Art({ src, size, picnum }: { src: Source<string>, size: number, picnum: number }) {
  const artEditor = useContext(ArtEditorContext);
  const info = getOrDefault(artEditor.artInfos.get(), picnum, EMPTY_INFO_EXTENDED);
  const url = useValue(src);
  const aliases = useValue(artEditor.aliases);
  const selected = useValue(artEditor.currentId);
  return <div className={`column-block art-preview ${styles({ selected: selected === picnum })}`}
    onClick={_ => artEditor.clickOnPicnum(picnum, false)}
    onDoubleClick={_ => artEditor.clickOnPicnum(picnum, true)}>
    <img alt='' src={url} width={size - 2} height={size - 16} />
    <div className="row-block art-preview-picnum">
      <div className="flex-fill" >{picnum}</div>
    </div>
    <div className="art-preview-info size" >{info.w}x{info.h}</div>
    <div className="art-preview-info alias">{aliases.get(picnum)}</div>
    {info.attrs.animType !== AnimationType.NO_ANIMATION && info.attrs.frames !== 0
      ? <Icon icon='video' className="art-preview-info anim" />
      : <></>}
  </div>;
}

export function Browser() {
  const artEditor = useContext(ArtEditorContext);
  const picnums = useValue(artEditor.picnums);
  const size = useValue(artEditor.previewSize);
  const gridRef = useRef<Grid>();

  const createCellRenderer = (width: number, height: number): GridCellRenderer => {
    const columnsCount = int(width / size);
    return ({ columnIndex, key, rowIndex, style }) => {
      const picnum = picnums[rowIndex * columnsCount + columnIndex];
      return (
        <div key={key} style={style}>
          <Art
            src={artEditor.getArt(picnum)}
            picnum={picnum}
            size={size}
          />
        </div>
      );
    }
  }

  useEffect(() => {
    const scrollToId = (picnum: number) => {
      const grid = gridRef.current;
      const cols = grid.props.columnCount;
      const picnums = artEditor.picnums.get();
      const idx = picnums.indexOf(picnum);
      const rowIndex = int(idx / cols);
      const columnIndex = idx % cols;
      grid.scrollToCell({ rowIndex, columnIndex })
    }
    return seq(artEditor.currentId.subscribe(scrollToId), artEditor.previewGridSize.subscribe(o => o.ifPresent(_ => scrollToId(artEditor.currentId.get()))));
  }, [artEditor.currentId, artEditor.picnums, artEditor.previewGridSize, gridRef]);

  return (
    <div className="flex-fill">
      <AutoSizer>
        {({ height, width }) => {
          const columns = int(width / size);
          const rowsPerPage = int(height / size)
          const rows = Math.ceil(picnums.length / columns);
          artEditor.previewGridSize.set(Optional.of([columns, rowsPerPage]));
          return <Grid
            ref={gridRef}
            height={height}
            width={width}
            columnCount={columns}
            rowCount={rows}
            rowHeight={size}
            columnWidth={size}
            cellRenderer={createCellRenderer(width, height)}
            overscanRowCount={1}
          />
        }}
      </AutoSizer>
    </div>);
}