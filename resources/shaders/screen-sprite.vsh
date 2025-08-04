precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

// gl_VertexID mapping
// 1,5--0 
// |\   |
// | \  |
// |  \ |
// |   \|
// 3---2,4 

uniform highp usampler2D infos;

in vec4 aPosIdx;
in ivec4 aOffSize_i16;
in uvec4 aPicnumTiles_u16;

out vec3 tc;
flat out ivec4 params;
flat out pic_t picInfo;
flat out float trans;

const vec2 tcs[6] = vec2[](
  vec2(1.0, 0.0), 
  vec2(0.0, 0.0), 
  vec2(1.0, 1.0), 
  vec2(0.0, 1.0),
  vec2(1.0, 1.0),
  vec2(0.0, 0.0));

vec2 getTc(float idx, float tiles) {
  vec2 size = vec2(1.0 / tiles);
  vec2 off = vec2(mod(idx, tiles), trunc(idx / tiles));
  return off * size + tcs[gl_VertexID] * size;
}

void main() {
  picInfo = loadPicInfo(infos, aPicnumTiles_u16.x, 0.0);
  vec4 epos = P * V * vec4(aPosIdx.xyz, 1.0);
  epos /= epos.w;
  vec2 halfscreen = screenSize / 2.0;
  vec2 vertexOff = vec2(ivec2(tcs[gl_VertexID]) * ivec2(1, -1) * aOffSize_i16.zw);
  vec2 screenPos = trunc(halfscreen + epos.xy * halfscreen + vec2(aOffSize_i16.xy) + vertexOff);
  vec2 pos = (screenPos - halfscreen) / halfscreen;
  gl_Position = vec4(pos.x, pos.y, epos.z, epos.w);
  tc = vec3(getTc(aPosIdx.w, float(aPicnumTiles_u16.y)), 1.0);
  trans = 1.0;
}