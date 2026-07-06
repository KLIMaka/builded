import { useValue, WorkplaneHandlers } from "app/modules/ui/commons";
import { mat4, vec3, vec4 } from "gl-matrix";
import React from "react";
import { Source } from "ts-utils/callbacks";
import { axis, rect, RenderGizmo, xPlus, yPlus, zPlus } from "./consts";

export function Gizmo(props: { width: number, height: number, camPos: Source<vec3>, projection: Source<mat4>, transform: Source<mat4>, pos: Source<vec3>, handlers: WorkplaneHandlers }) {
  const proj = useValue(props.projection);
  const transform = useValue(props.transform);
  const pos = useValue(props.pos);
  const camPos = useValue(props.camPos);

  const scale = ((2 * vec3.distance(pos, camPos)) / props.height) * 60;
  const pos0 = vec4.fromValues(pos[0], pos[1], pos[2], 1);
  const posx = vec4.fromValues(pos[0] + scale, pos[1], pos[2], 1);
  const posy = vec4.fromValues(pos[0], pos[1], pos[2] + scale, 1);
  const posz = vec4.fromValues(pos[0], pos[1] + scale, pos[2], 1);

  const mat = mat4.create();
  mat4.identity(mat);
  mat4.translate(mat, mat, vec3.fromValues(props.width / 2, props.height / 2, 0));
  mat4.scale(mat, mat, vec3.fromValues(props.width / 2, -props.height / 2, scale))
  mat4.mul(mat, mat, proj);
  mat4.mul(mat, mat, transform);

  const elements = [
    axis('X', xPlus, 'axis-plus', mat, posx, pos0, true),
    axis('Y', yPlus, 'axis-plus', mat, posy, pos0, true),
    axis('Z', zPlus, 'axis-plus', mat, posz, pos0, true),
    rect(pos0, scale, 'x', yPlus, mat),
    rect(pos0, scale, 'y', zPlus, mat),
    rect(pos0, scale, 'z', xPlus, mat),
  ];

  return <svg width={props.width} height={props.height} xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute' }}
    onContextMenu={e => e.preventDefault()}
    onMouseMove={e => props.handlers.handleMouseMove(e.nativeEvent)}
    onWheel={e => props.handlers.handleWheel(e.nativeEvent)}
    onMouseUp={e => props.handlers.handleMouseButton(e.nativeEvent)}
    onMouseDown={e => props.handlers.handleMouseButton(e.nativeEvent)}
    onClick={e => props.handlers.handleClick(e.nativeEvent)}
  >
    <RenderGizmo elements={elements} />
  </svg>;
}