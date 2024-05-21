import { ActionDescriptorsContext, ActionsChannelContext, Column, CurrentActionsChannelContext, Row, Spacer, styles, useValue } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { SearchBox, SearchBoxRef } from "@ui/search-box";
import { Disconnector, Source, transformed, value } from "@utils/callbacks";
import { int } from "@utils/mathutils";
import { Consumer, Function } from "@utils/types";
import { Window } from "app/apis/ui1";
import React, { MouseEvent, WheelEvent, useContext, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AutoSizer, Grid, GridCellRenderer } from "react-virtualized";
import WinBox from "react-winbox";
import { ArtEditorContext, ArtEditorImpl } from "./model";
import { AnimationType } from "build/formats/art";

export type WorkplaneBuilder = Function<HTMLCanvasElement, Disconnector>;

function Art({ src, size, picnum }: { src: Source<string>, size: number, picnum: number }) {
  const artEditor = useContext(ArtEditorContext);
  const info = artEditor.artFiles.get().get(picnum);
  const url = useValue(src);
  const selected = useValue(artEditor.currentId);
  return <div className={`column-block art-preview ${styles({ selected: selected === picnum })}`}>
    <img alt='' src={url} width={size - 2} height={size - 16} onClick={_ => artEditor.setCurrentId(picnum)} />
    <div className="row-block art-preview-picnum">
      <div className="flex-fill" >{picnum}</div>
    </div>
    <div style={{ fontSize: '10px', position: 'absolute', padding: '2px 2px', left: 10 }}>{info?.w}x{info?.h}</div>
    {info?.attrs.animType !== AnimationType.NO_ANIMATION && info?.attrs.frames !== 0
      ? <div className="fa-solid fa-video" style={{ fontSize: '10px', position: 'absolute', padding: '2px 2px', right: 10 }} />
      : <></>}
  </div>;
}

function Browser() {
  const artEditor = useContext(ArtEditorContext);
  const picnums = useValue(artEditor.filteredPicnums);
  const size = useValue(artEditor.previewSize);

  const createCellRenderer = (width: number, height: number): GridCellRenderer => {
    const columnsCount = int(width / size);
    return ({ columnIndex, key, rowIndex, style }) => {
      const picnum = picnums[rowIndex * columnsCount + columnIndex];
      return (
        <div key={key} style={style}>
          <Art
            src={artEditor.getArt(picnum, size)}
            picnum={picnum}
            size={size}
          />
        </div>
      );
    }
  }

  return (
    <div className="flex-fill">
      <AutoSizer>
        {({ height, width }) => (
          <Grid
            height={height}
            width={width}
            columnCount={int(width / size)}
            rowCount={Math.ceil(picnums.length / int(width / size))}
            rowHeight={size}
            columnWidth={size}
            cellRenderer={createCellRenderer(width, height)}
          />
        )}
      </AutoSizer>
    </div>);
}

function Plane({ height, width, builder }: { height: number, width: number, builder: WorkplaneBuilder }) {
  const ref = useRef<HTMLCanvasElement>();
  useEffect(() => builder(ref.current), [builder]);
  return <canvas ref={ref} height={height} width={width} style={{ position: 'absolute' }} />
}

function createController(artEditor: ArtEditorImpl) {
  let isDrag = false;
  let oldx = 0;
  let oldy = 0;
  function handleMouseMove(e: MouseEvent) {
    if (isDrag) {
      const dx = e.clientX - oldx;
      const dy = e.clientY - oldy;
      artEditor.ctx.modImmer(ctx => { ctx.xoff += dx; ctx.yoff += dy })
    }
    oldx = e.clientX;
    oldy = e.clientY;
  }
  function handleWheel(e: WheelEvent) { artEditor.ctx.modImmer(ctx => ctx.scale *= e.deltaY > 0 ? (1 / 1.1) : e.deltaY < 0 ? 1.1 : 1) }
  function handleMouseButton(e: MouseEvent) { isDrag = e.buttons === 1 }
  return {
    onMouseDown: handleMouseButton,
    onMouseUp: handleMouseButton,
    onMouseMove: handleMouseMove,
    onWheel: handleWheel
  }
}

function Workplane() {
  const artEditor = useContext(ArtEditorContext);
  return (<div className='flex-fill' {...createController(artEditor)}>
    <AutoSizer >
      {({ height, width }) => (
        <>
          <Plane width={width} height={height} builder={artEditor.rasterWorkplaneRenderer()} />
          <Plane width={width} height={height} builder={artEditor.gridRenderer()} />
          <Plane width={width} height={height} builder={artEditor.centerRenderer()} />
          <Plane width={width} height={height} builder={artEditor.imageInfoRenderer()} />
        </>
      )}
    </AutoSizer>
  </div>)
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


export function ArtEditorUiImpl({ onClose, windowConsumer }: { onClose: Consumer<void>, windowConsumer: Consumer<Window> }) {
  const artEditor = useContext(ArtEditorContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const channel = actionsChannel.child('art-editor');
  const winRef = useRef<WinBox>();
  const searchRef = useRef<SearchBoxRef>();
  const gridMenu = value(false);
  const pluMenu = value(false)

  const gridLabel = transformed(artEditor.gridSize, grid =>
    <div className='row-block gap-10 baseline-aligned flex-nowrap' style={{ width: '60px' }}>
      <div className={`fa-solid fa-border-all`} />
      <div className='text-ellipsis'>{grid === 0 ? 'None' : `${grid}px`}</div>
    </div>);

  const pluLabel = transformed(artEditor.currentPlu, pid =>
    <div className='row-block gap-10 baseline-aligned flex-nowrap' style={{ width: '100px' }}>
      <div className={`fa-solid fa-palette`} />
      <div className='text-ellipsis'>{artEditor.plus.get().get(pid).name}</div>
    </div>);

  useEffect(() => {
    windowConsumer({ winbox: winRef.current })
    const ctx = actionDescriptors.sub('win');
    const aeCtx = actionDescriptors.sub('art-editor');
    artEditor.setChannel(channel);
    return channel.collector().add(
      ctx.bindSync('close', () => winRef.current.minimize()),
      aeCtx.bindSync('grid', () => gridMenu.set(true)),
      aeCtx.bindSync('search', () => searchRef.current.focus()),
      ...Object.values(artEditor.actions),
    );
  }, [actionDescriptors, artEditor, channel, gridMenu, windowConsumer]);

  return (
    <ActionsChannelContext.Provider value={channel}>
      <WinBox
        ref={winRef}
        title="ART Editor"
        className="window"
        x={artEditor.state.get().x}
        y={artEditor.state.get().y}
        noFull={true}
        width={artEditor.state.get().width}
        height={artEditor.state.get().height}
        minHeight={400}
        minWidth={400}
        onClose={_ => onClose()}
        onFocus={() => currentActions(channel)}
        onResize={(w, h) => artEditor.setSize(w, h)}
        onMove={(x, y) => artEditor.setPosition(x, y)}
      >
        <Column>
          <Row className='window-toolbar flex-auto'>
            <MenuButton openValue={pluMenu} label={pluLabel} items={artEditor.pluItems} />
            <MenuButton openValue={gridMenu} label={gridLabel} items={artEditor.gridSizes} />
            <Spacer />
            <SearchBox ref={searchRef} value={artEditor.filter} channelName='search' />
          </Row>
          <PanelGroup direction={"horizontal"} className="flex-fill">
            <Panel className="column-block">
              <Workplane />
            </Panel>
            <PanelResizeHandle className="hspacer" />
            <Panel className="column-block">
              <Browser />
            </Panel>
          </PanelGroup>
          <Footer />
        </Column>
      </WinBox>
    </ActionsChannelContext.Provider>
  );
}