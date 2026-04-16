precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

uniform lowp sampler2DArray atlas;
uniform sampler2D pal;
uniform sampler2D plu;
uniform highp usampler2D infos;

in vec3 tc;
in vec4 parallax;
in float shadow;
flat in ivec4 params;
flat in pic_t picInfo;
flat in float trans;

out vec4 fragColor;

#define LOCAL_VIS (float((params.z + 16) & 0xff) / 16.0)
#define GLOBAL_VIS (float(globalVis))
#define DEPTH_SHADOW_SCALE (float(depthShadowScale))
#define GLOBAL_SHADOW (float(globalShadow))
#define LOCAL_SHADOW (float(shadow))
#define PAL (float(params.y))
#define DETPH_OFF (float(params.w))
#define PARALLAX (parallax.w == 1.0)
#include "inc.fsh"

// vec3 barioOff() {
//   vec2 barys = vec2(bariocentric.y, bariocentric.z);
//   vec2 deltas = fwidth(barys);
//   barys = smoothstep(vec2(0.0), 2.0 * deltas, barys);
//   float minBary = min(barys.x, barys.y);
//   return vec3(1.0 - minBary);
// }

void main() {
  vec3 atlasTc =  getTc(tc, picInfo, infos, atlas, parallax, true, true);
  vec3 color = palLookup(atlasTc, atlas, pal, plu);
  fragColor = vec4(color, trans);
}
