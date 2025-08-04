import { Column, Icon, Row, Spacer, ToggleButton, useValue, useValuesContainer, Workplane, workplaneController } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { SearchBoxOracle } from "@ui/search-box";
import React, { useContext } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ArtEditorContext, Browser } from "./arteditor-api";
import { ArtEditorImpl } from "./arteditor-model";


function Footer() {
  const artEditor = useContext(ArtEditorContext);
  const artFiles = useValue(artEditor.art);
  const picnums = useValue(artEditor.picnums);
  const files = picnums.length;
  return (<div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{files} Arts in {artFiles.length} File(s)</div>
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