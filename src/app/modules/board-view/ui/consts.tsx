import { mat4, vec3, vec4 } from "gl-matrix";
import { match } from "ts-pattern";
import { Interpolator, LinearInterpolator } from "ts-utils/interpolator";
import React from "react";

export type Color = {
  fillStart: vec4,
  fillEnd: vec4,
  strokeStart: vec4,
  strokeEnd: vec4
}

export const xPlus: Color = {
  fillStart: vec4.fromValues(255, 54, 83, 1),
  fillEnd: vec4.fromValues(157, 59, 74, 1),
  strokeStart: vec4.fromValues(255, 54, 83, 1),
  strokeEnd: vec4.fromValues(157, 59, 74, 1),
}

export const yPlus: Color = {
  fillStart: vec4.fromValues(138, 219, 0, 1),
  fillEnd: vec4.fromValues(100, 140, 35, 1),
  strokeStart: vec4.fromValues(138, 219, 0, 1),
  strokeEnd: vec4.fromValues(100, 140, 35, 1),
}

export const zPlus: Color = {
  fillStart: vec4.fromValues(44, 143, 255, 1),
  fillEnd: vec4.fromValues(53, 103, 158, 1),
  strokeStart: vec4.fromValues(44, 143, 255, 1),
  strokeEnd: vec4.fromValues(53, 103, 158, 1),
}

export const xMinus: Color = {
  fillStart: vec4.fromValues(109, 61, 68, 1),
  fillEnd: vec4.fromValues(109, 61, 68, 0),
  strokeStart: vec4.fromValues(255, 54, 83, 1),
  strokeEnd: vec4.fromValues(157, 59, 74, 1),
}

export const yMinus: Color = {
  fillStart: vec4.fromValues(82, 101, 50, 1),
  fillEnd: vec4.fromValues(82, 101, 50, 0),
  strokeStart: vec4.fromValues(138, 219, 0, 1),
  strokeEnd: vec4.fromValues(100, 140, 35, 1),
}

export const zMinus: Color = {
  fillStart: vec4.fromValues(59, 83, 109, 1),
  fillEnd: vec4.fromValues(59, 83, 109, 0),
  strokeStart: vec4.fromValues(44, 143, 255, 1),
  strokeEnd: vec4.fromValues(53, 103, 158, 1),
}

export function toRgbaString(color: vec4): string {
  return `rgba(${color[0].toFixed(0)}, ${color[1].toFixed(0)}, ${color[2].toFixed(0)}, ${color[3]})`;
}

export type AxisType = 'axis-minus' | 'axis-plus';
export type AxisProps = {
  type: AxisType,
  depth: number,
  pos: vec3
  center: vec3,
  fillColor: string,
  strokeColor: string,
  label: string,
}

type RectType = [vec4, vec4, vec4, vec4];
export type RectProps = {
  type: 'rect'
  depth: number,
  rect: RectType,
  color: string,
}

type GizmoProps = AxisProps | RectProps;
const DROPPED = vec4.fromValues(Number.NaN, Number.NaN, Number.NaN, Number.NaN);

function transform(vertex: vec3, mat: mat4, dropBack: boolean): vec4 {
  const result = vec4.fromValues(vertex[0], vertex[1], vertex[2], 1);
  vec4.transformMat4(result, result, mat);
  if (dropBack && result[2] < 0) return DROPPED;
  vec4.scale(result, result, 1 / result[3]);
  return result;
}

const VEC4_INTER = (i: Interpolator<number>) => (l: vec4, r: vec4, t: number) => vec4.fromValues(i(l[0], r[0], t), i(l[1], r[1], t), i(l[2], r[2], t), i(l[3], r[3], t));
const INTER = VEC4_INTER(LinearInterpolator);

export function axis(label: string, color: Color, type: AxisType, m: mat4, position: vec3, origin: vec3, dropBack = false): AxisProps {
  const pos = transform(position, m, dropBack);
  const center = transform(origin, m, dropBack);
  const t = ((pos[2] - center[2]) + 1) / 2;
  const fill = INTER(color.fillStart, color.fillEnd, t);
  const stroke = INTER(color.strokeStart, color.strokeEnd, t);
  const fillColor = toRgbaString(fill);
  const strokeColor = toRgbaString(stroke);
  const depth = pos[2];
  return { pos, center, fillColor, strokeColor, type, label, depth };
}

const OFFS = [[0, 0], [0, 1], [1, 1], [1, 0]];
const AXIS = { x: [0, 1, 2], y: [0, 2, 1], z: [2, 0, 1] };

function getOffsetVector(scale: number, index: number, axis: keyof typeof AXIS): vec4 {
  const o = [scale * 0.4, scale * 0.7];
  const values = [o[OFFS[index][0]], o[OFFS[index][1]], 0];
  return vec4.fromValues(values[AXIS[axis][0]], values[AXIS[axis][1]], values[AXIS[axis][2]], 0);
}

function getRect(center: vec3, scale: number, axis: keyof typeof AXIS): RectType {
  const p0 = vec4.add(vec4.create(), center, getOffsetVector(scale, 0, axis));
  const p1 = vec4.add(vec4.create(), center, getOffsetVector(scale, 1, axis));
  const p2 = vec4.add(vec4.create(), center, getOffsetVector(scale, 2, axis));
  const p3 = vec4.add(vec4.create(), center, getOffsetVector(scale, 3, axis));
  return [p0, p1, p2, p3];
}

export function rect(position: vec3, scale: number, axis: keyof typeof AXIS, color: Color, m: mat4): GizmoProps {
  const rect = getRect(position, scale, axis);
  const projRect = rect.map(r => transform(r, m, true)) as RectType;
  const depth = rect[0][2];
  return { rect: projRect, color: toRgbaString(color.strokeStart), type: 'rect', depth };
}

export function RenderGizmo(props: { elements: GizmoProps[] }) {
  return props.elements.sort((l, r) => r.depth - l.depth)
    .map((props, i) =>
      match(props)
        .with({ type: 'axis-plus' }, p =>
          <g key={i}>
            <line x1={p.center[0]} y1={p.center[1]} x2={p.pos[0]} y2={p.pos[1]} strokeWidth={4} stroke={p.strokeColor} className="axes-line" />
            <g transform={`translate(${p.pos[0]},${p.pos[1]})`} className="axes-label">
              <circle cx={0} cy={0} r={10} fill={p.fillColor} />
              <text x={0} y={0}>{p.label}</text>
            </g>
          </g>)
        .with({ type: 'axis-minus' }, p =>
          <g key={i} transform={`translate(${p.pos[0]},${p.pos[1]})`} className="axes-label minus">
            <circle cx={0} cy={0} r={10} stroke={p.strokeColor} strokeWidth={2} fill={p.fillColor} />
            <text x={0} y={0}>{p.label}</text>
          </g>)
        .with({ type: "rect" }, p => <polygon key={i} points={p.rect.map(p => `${p[0]},${p[1]}`).join(' ')} stroke={p.color} fill={p.color} className="axes-rect" />)
        .exhaustive());
}