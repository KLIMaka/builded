import { ToggleButton, Column, Icon, Row, Spacer, styles, useValue, useValuesContainer, Workplane, workplaneController } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { SearchBoxOracle } from "@ui/search-box";
import { Source } from "@utils/callbacks";
import { getOrDefault } from "@utils/collections";
import { int } from "@utils/mathutils";
import { EMPTY_INFO_EXTENDED } from "app/apis/engine";
import { AnimationType } from "build/formats/art";
import Optional from "optional-js";
import React, { createContext, useContext, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AutoSizer, Grid, GridCellRenderer } from "react-virtualized";
import { ArtEditorImpl } from "./arteditor-model";

const ArtEditorContext = createContext<ArtEditorImpl>(null);

function Art({ src, size, picnum }: { src: Source<string>, size: number, picnum: number }) {
  const artEditor = useContext(ArtEditorContext);
  const info = getOrDefault(artEditor.artInfos.get(), picnum, EMPTY_INFO_EXTENDED);
  const url = useValue(src);
  const selected = useValue(artEditor.currentId);
  return <div className={`column-block art-preview ${styles({ selected: selected === picnum })}`} onClick={_ => artEditor.setCurrentId(picnum)}>
    <img alt='' src={url} width={size - 2} height={size - 16} />
    <div className="row-block art-preview-picnum">
      <div className="flex-fill" >{picnum}</div>
    </div>
    <div className="art-preview-info size" >{info.w}x{info.h}</div>
    <div className="art-preview-info alias">{artEditor.aliases.get().get(picnum)}</div>
    {info.attrs.animType !== AnimationType.NO_ANIMATION && info.attrs.frames !== 0
      ? <Icon icon='video' className="art-preview-info anim" />
      : <></>}
  </div>;
}

function Browser() {
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
    return artEditor.currentId.subscribe(id => {
      const grid = gridRef.current;
      const cols = grid.props.columnCount;
      const picnums = artEditor.picnums.get();
      const idx = picnums.indexOf(id);
      const rowIndex = int(idx / cols);
      const columnIndex = idx % cols;
      grid.scrollToCell({ rowIndex, columnIndex })
    });
  }, [artEditor.currentId, artEditor.picnums, artEditor.previewGridSize, gridRef]);

  return (
    <div className="flex-fill">
      <AutoSizer>
        {({ height, width }) => {
          const columns = int(width / size);
          const rowsPerPage = int(height / size)
          const rows = Math.ceil(picnums.length / columns);
          artEditor.previewGridSize.set(Optional.ofNullable([columns, rowsPerPage]));
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

function Footer() {
  const artEditor = useContext(ArtEditorContext);
  const artFiles = useValue(artEditor.art);
  const picnums = useValue(artEditor.picnums);
  const files = picnums.length;
  return (<div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{files} Arts in {artFiles.length} File(s) </div>
  </div>)
}


export function ArtEditorUiImpl({ artEditor: model }: { artEditor: ArtEditorImpl }) {
  const values = useValuesContainer('art-editor');

  const gridLabel = values.transformed('gridLabel', model.gridSize, grid =>
    <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '60px' }}>
      <Icon icon='border-all' />
      <div className='text-ellipsis'>{grid === 0 ? 'None' : `${grid}px`}</div>
    </Row>)

  const pluLabel = values.transformed('pluLabel', model.currentPlu, pid =>
    <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '100px' }}>
      <Icon icon='palette' />
      <div className='text-ellipsis'>{model.plus.get()[pid].name}</div>
    </Row>)

  const superSampleLabel = values.transformed('superSampleLabel', model.superSample, ss =>
    <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '60px' }}>
      <Icon icon='stairs' />
      <div className='text-ellipsis'>{ss === 0 ? 'None' : `${ss}`}</div>
    </Row>)

  const previewSizeLabel = values.transformed('previewSizeLabel', model.previewSize, ps =>
    <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '90px' }}>
      <Icon icon='stairs' />
      <div className='text-ellipsis'>{`Preview ${ps}px`}</div>
    </Row>)

  return (
    <ArtEditorContext.Provider value={model}>
      <Column>
        <Row className='window-toolbar flex-auto'>
          <MenuButton openValue={model.pluMenuOpen} label={pluLabel} items={model.pluItems} navigator={model.pluNavigator} />
          <MenuButton openValue={model.gridMenuOpen} label={gridLabel} items={model.gridSizes} />
          <MenuButton openValue={model.superSampleMenuOpen} label={superSampleLabel} items={model.superSamples} />
          <MenuButton openValue={model.previewSizesOpen} label={previewSizeLabel} items={model.previewSizes} />
          <ToggleButton pressedValue={model.repeat} icon='grip'>Repeat</ToggleButton>
          <Spacer />
          <SearchBoxOracle
            focusSignal={model.searchSignal}
            value={model.searchQuery}
            channelName='search'
            oracle={() => model.searchOracle()}
            width="200px"
            focusedWidth="400px"
          />
        </Row>
        <PanelGroup direction={"horizontal"} className="flex-fill">
          <Panel className="column-block">
            <Workplane builders={[
              model.rasterWorkplaneRenderer(),
              model.gridRenderer(),
              model.centerRenderer(),
              model.imageInfoRenderer(),
              workplaneController(model.ctx),
            ]} />
          </Panel>
          <PanelResizeHandle className="hspacer" />
          <Panel className="column-block">
            <Browser />
          </Panel>
        </PanelGroup>
        <Footer />
      </Column>
    </ArtEditorContext.Provider>
  );
}