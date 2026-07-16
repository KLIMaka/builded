import { UI_UTILS } from "app/apis/ui";
import { VALUES } from "app/apis/values";
import React, { useEffect, useRef } from "react";
import { cookbook } from "ts-utils/cookbook";
import { getInstances, Injector } from "ts-utils/injector";

const ID = "text-editor"

function TextEditor(props: { monaco: typeof import("monaco-editor"), value: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    props.monaco.editor.create(frameRef.current as HTMLDivElement, {
      automaticLayout: true,
      theme: "vs-dark",
      value: props.value,
      wordWrap: "wordWrapColumn",
      wordWrapColumn: 80,
      wrappingIndent: "indent",
    });
  })
  return <div className="flex-fill" ref={frameRef} style={{ minWidth: 0 }} />
}

export async function createTextEditor(injector: Injector, text: string): Promise<void> {
  const [values, uiUtils] = await getInstances(injector, VALUES, UI_UTILS);
  const localValues = values.create(ID);
  uiUtils.addWindow(`Opening text editor`, cookbook(book => {
    const editor = book.recepie('Loading Monaco Editor', [], () => import("monaco-editor"));
    return book.recepie('', [editor], async editor => uiUtils.windowBuilder(ID, localValues)
      .titleFromId()
      .minSize(400, 400)
      .disposable(localValues)
      .blockContext()
      .build(<TextEditor monaco={editor} value={text} />))
  }));
}