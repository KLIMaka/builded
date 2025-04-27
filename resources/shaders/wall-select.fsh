precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "dither-inc.fsh"

in vec3 tc;
in vec3 wpos;
flat in pic_t picInfo;

out vec4 fragColor;

float renderGrid() {
  // vec2 coord = tc.xy;
  // bvec2 odd = greaterThan(fract(coord - 0.5), vec2(0.5));
  // return odd.x ^^ odd.y;

  vec2 size = picInfo.sizeOff.xy;
  float fgrid = float(grid) / 4.0;
  vec2 coord = (size * tc.xy) / fgrid;
  vec2 f = abs(fract(coord - 0.5) - 0.5);
  vec2 gridDet = (f - 0.25 / fgrid) / fwidth(coord);

  // vec2 coord2 = tc.xy;
  vec2 coord2 = coord * 4.0;
  vec2 gridDet2 = abs(fract(coord2 - 0.5) - 0.5) / fwidth(coord2);
  float line = min(gridDet.x, gridDet.y);
  float line2 = min(gridDet2.x, gridDet2.y);
  float a = 1.0 - min(line, 1.0);
  float b = 1.0 - min(line2, 1.0);

  return clamp(a + b * 0.5, 0.0, 1.0);
}

void main() {
  float grid = renderGrid();
  fragColor = vec4(vec3(1.0), 0.1 + grid * 0.5);
}
