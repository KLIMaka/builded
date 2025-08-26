import { mat3, mat4, vec2, vec3, vec4 } from "gl-matrix";
import React from "react";
import { Source } from "ts-utils/callbacks";
import { Interpolator, LinearInterpolator } from "ts-utils/interpolator";
import { deg2rad } from "ts-utils/mathutils";
import { useValue } from "./commons";

type AxisProps = {
  pos: vec3,
  fillColor: string,
  strokeColor: string,
  label: string,
  type: AxisType,
}

function PlusAxis(props: AxisProps) {
  return <g>
    <line x1={50} y1={50} x2={props.pos[0]} y2={props.pos[1]} strokeWidth={4} stroke={props.strokeColor} className="axes-line" />
    <g transform={`translate(${props.pos[0]},${props.pos[1]})`}>
      <circle cx={0} cy={0} r={10} fill={props.fillColor} />
      <text x={0} y={0} className="axes-label">{props.label}</text>
    </g>
  </g>
}

function MinusAxis(props: AxisProps) {
  return <g transform={`translate(${props.pos[0]},${props.pos[1]})`}>
    <circle cx={0} cy={0} r={10} stroke={props.strokeColor} strokeWidth={2} fill={props.fillColor} />
    <text x={0} y={0} className="axes-label minus">{props.label}</text>
  </g>
}

const off = vec3.fromValues(50, 50, 0);
const scale = vec3.fromValues(40, 40, 1);
function calcPos(x: number, y: number, z: number, m: mat3): vec3 {
  const vec = vec3.fromValues(x, y, z);
  vec3.transformMat3(vec, vec, m);
  vec3.mul(vec, vec, scale);
  vec3.add(vec, vec, off);
  return vec;
}

type AxisType = 'minus' | 'plus';
type Color = {
  fillStart: vec4,
  fillEnd: vec4,
  strokeStart: vec4,
  strokeEnd: vec4
}

const vec4Inter = (i: Interpolator<number>) => (l: vec4, r: vec4, t: number) => vec4.fromValues(i(l[0], r[0], t), i(l[1], r[1], t), i(l[2], r[2], t), i(l[3], r[3], t));
const inter = vec4Inter(LinearInterpolator);
function axis(label: string, color: Color, type: AxisType, m: mat3, x: number, y: number, z: number): AxisProps {
  const pos = calcPos(x, y, z, m);
  const t = (pos[2] + 1) / 2;
  const fill = inter(color.fillStart, color.fillEnd, t);
  const stroke = inter(color.strokeStart, color.strokeEnd, t);
  const fillColor = `rgba(${fill[0].toFixed(0)}, ${fill[1].toFixed(0)}, ${fill[2].toFixed(0)}, ${fill[3]})`;
  const strokeColor = `rgba(${stroke[0].toFixed(0)}, ${stroke[1].toFixed(0)}, ${stroke[2].toFixed(0)}, ${stroke[3]})`;
  return { pos, fillColor, strokeColor, type, label };
}

const xPlus: Color = {
  fillStart: vec4.fromValues(255, 54, 83, 1),
  fillEnd: vec4.fromValues(157, 59, 74, 1),
  strokeStart: vec4.fromValues(255, 54, 83, 1),
  strokeEnd: vec4.fromValues(157, 59, 74, 1),
}

const yPlus: Color = {
  fillStart: vec4.fromValues(138, 219, 0, 1),
  fillEnd: vec4.fromValues(100, 140, 35, 1),
  strokeStart: vec4.fromValues(138, 219, 0, 1),
  strokeEnd: vec4.fromValues(100, 140, 35, 1),
}

const zPlus: Color = {
  fillStart: vec4.fromValues(44, 143, 255, 1),
  fillEnd: vec4.fromValues(53, 103, 158, 1),
  strokeStart: vec4.fromValues(44, 143, 255, 1),
  strokeEnd: vec4.fromValues(53, 103, 158, 1),
}

const xMinus: Color = {
  fillStart: vec4.fromValues(109, 61, 68, 1),
  fillEnd: vec4.fromValues(109, 61, 68, 0),
  strokeStart: vec4.fromValues(255, 54, 83, 1),
  strokeEnd: vec4.fromValues(157, 59, 74, 1),
}

const yMinus: Color = {
  fillStart: vec4.fromValues(82, 101, 50, 1),
  fillEnd: vec4.fromValues(82, 101, 50, 0),
  strokeStart: vec4.fromValues(138, 219, 0, 1),
  strokeEnd: vec4.fromValues(100, 140, 35, 1),
}

const zMinus: Color = {
  fillStart: vec4.fromValues(59, 83, 109, 1),
  fillEnd: vec4.fromValues(59, 83, 109, 0),
  strokeStart: vec4.fromValues(44, 143, 255, 1),
  strokeEnd: vec4.fromValues(53, 103, 158, 1),
}

export function Axes(props: { cameraAngles: Source<vec2> }) {
  const [ax, ay] = useValue(props.cameraAngles);
  const mat = mat4.create();
  mat4.identity(mat);
  mat4.rotateX(mat, mat, deg2rad(-ax));
  mat4.rotateY(mat, mat, deg2rad(ay));

  const m = mat3.fromMat4(mat3.create(), mat);
  const points = [
    axis('X', xPlus, 'plus', m, 1, 0, 0),
    axis('Y', yPlus, 'plus', m, 0, 0, -1),
    axis('Z', zPlus, 'plus', m, 0, -1, 0),
    axis('-X', xMinus, 'minus', m, -1, 0, 0),
    axis('-Y', yMinus, 'minus', m, 0, 0, 1),
    axis('-Z', zMinus, 'minus', m, 0, 1, 0)
  ].sort((l, r) => r.pos[2] - l.pos[2]);

  return <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg" className="axes">
    <circle cx="50" cy="50" r="50" className="axes-area" />
    {points.map(p => p.type === 'plus'
      ? <PlusAxis {...p} key={p.label} />
      : <MinusAxis {...p} key={p.label} />
    )}
  </svg>;
}

// export function Axes(props: { cameraAngles: Source<vec2> }) {
//   const [ax, ay] = useValue(props.cameraAngles);

//   return <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg" style={{ transform: `perspective(100px) rotateX(${ax - 90}deg) rotateZ(${-ay}deg)` }}>
//     <circle cx="50" cy="50" r="40" strokeWidth={10} stroke="red" fill="none" />
//     <line x1="50" y1="50" x2="100" y2="50" stroke="red" strokeWidth={10} />
//   </svg>;
// }