import { mat4, vec2, vec3 } from "gl-matrix";
import React from "react";
import { Source } from "ts-utils/callbacks";
import { deg2rad } from "ts-utils/mathutils";
import { useValue } from "../../ui/commons";
import { axis, RenderGizmo, xMinus, xPlus, yMinus, yPlus, zMinus, zPlus } from "./consts";

export function Axes(props: { cameraAngles: Source<vec2> }) {
  const [ax, ay] = useValue(props.cameraAngles);
  const m = mat4.create();
  mat4.identity(m);
  mat4.translate(m, m, vec3.fromValues(50, 50, 0));
  mat4.scale(m, m, vec3.fromValues(38, 38, 1));
  mat4.rotateX(m, m, deg2rad(-ax));
  mat4.rotateY(m, m, deg2rad(ay));
  const origin = vec3.fromValues(0, 0, 0);
  const elements = [
    axis('X', xPlus, 'axis-plus', m, vec3.fromValues(1, 0, 0), origin),
    axis('Y', yPlus, 'axis-plus', m, vec3.fromValues(0, 0, -1), origin),
    axis('Z', zPlus, 'axis-plus', m, vec3.fromValues(0, -1, 0), origin),
    axis('-X', xMinus, 'axis-minus', m, vec3.fromValues(-1, 0, 0), origin),
    axis('-Y', yMinus, 'axis-minus', m, vec3.fromValues(0, 0, 1), origin),
    axis('-Z', zMinus, 'axis-minus', m, vec3.fromValues(0, 1, 0), origin)
  ];

  return <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg" className="axes">
    <circle cx="50" cy="50" r="50" className="axes-area" />
    <RenderGizmo elements={elements} />)
  </svg>;
}