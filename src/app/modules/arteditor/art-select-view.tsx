import { Column, Row, Spacer, useValue } from "@ui/commons";
import { SearchBoxOracle } from "@ui/search-box";
import React, { useContext } from "react";
import { ArtSelectImpl } from "./art-select-model";
import { ArtEditorContext, Browser } from "./arteditor-api";


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

export function ArtSelectUiImpl({ artEditor: model }: { artEditor: ArtSelectImpl }) {
  return (
    <ArtEditorContext.Provider value={model}>
      <Column>
        <Row className='window-toolbar flex-auto'>
          <Spacer />
          {/* <SearchBoxOracle
            focusSignal={model.searchSignal}
            value={model.searchQuery}
            channelName='search'
            oracle={() => model.searchOracle()}
            width="200px"
            focusedWidth="400px"
          /> */}
        </Row>
        <Browser />
        <Footer />
      </Column>
    </ArtEditorContext.Provider>
  );
}