import { ACTION_DESCRIPTORS } from "app/apis/actions";
import { Window } from "app/apis/ui";
import { VALUES } from "app/apis/values";
import React, { useEffect, useRef } from "react";
import { getInstances, Injector } from "ts-utils/injector";
import { WindowBuilder } from "../ui/windows-common";
import { Result, resultAsync } from "ts-utils/types";

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

export async function createTextEditor(injector: Injector, text: string): Promise<Result<Window>> {
  return resultAsync(async () => {
    const [actionDescriptors, values] = await getInstances(injector, ACTION_DESCRIPTORS, VALUES);
    const localValues = values.create(ID);
    const editor = await import("monaco-editor");

    return new WindowBuilder(ID, actionDescriptors, localValues)
      .titleFromId()
      .minSize(400, 400)
      .disposable(localValues)
      .build(<TextEditor monaco={editor} value={text} />)
  });
}