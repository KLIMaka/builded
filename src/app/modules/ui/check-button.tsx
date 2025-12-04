import React from "react";
import { Value } from "ts-utils/callbacks";
import { useValue } from "./commons";

export type CheckProps = Readonly<{
  label: string,
  value: Value<boolean>
}>

export function Check(props: CheckProps) {
  const value = useValue(props.value);
  return <div style={{ alignItems: 'baseline', display: 'inline-flex', gap: '2px' }} >
    <input type="checkbox" style={{ position: 'relative', top: '0.2em', left: '-0.2em' }} checked={value} onChange={e => props.value.set(e.target.checked)} />
    {props.label}
  </div>
}