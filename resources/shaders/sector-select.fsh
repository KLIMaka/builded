precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

in vec3 tc;
in vec3 wpos;
in vec2 gridPos;

out vec4 fragColor;

float renderGrid() {
  float fgrid = float(grid) * 4.0;
  vec2 coord = gridPos / fgrid;
  vec2 f = abs(fract(coord - 0.5) - 0.5);
  vec2 gridDet = (f - 4.0 / fgrid) / fwidth(coord);

  // vec2 coord2 = tc.xy;
  vec2 coord2 = coord * 4.0;
  vec2 gridDet2 = abs(fract(coord2 - 0.5) - 0.5) / fwidth(coord2);
  float line = min(gridDet.x, gridDet.y);
  float line2 = min(gridDet2.x, gridDet2.y);
  float a = 1.0 - min(line, 1.0);
  float b = 1.0 - min(line2, 1.0);

  // float dist = 1.0 - pow(smoothstep(0.0, 64.0 * 1024.0, length(curpos - wpos)), 32.0);
  // return vec4(0.4, 0.4, 0.4, a * dist) + vec4(0.4, 0.6, 0.4, b * dist);
  // return  vec4(0.4, 0.6, 0.4, b * dist);
  // return b > 0.0 ? vec4(0.984, 0.78, 0.118, b * dist) : vec4(0.4, 0.4, 0.4, a * dist);

  return clamp(a + b * 0.5, 0.0, 1.0);
}

void main() {
  float grid = renderGrid();
  fragColor = vec4(vec3(1.0),  0.1 + grid * 0.5);
}
