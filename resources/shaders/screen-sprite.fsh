precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

uniform lowp sampler2DArray atlas;
uniform sampler2D pal;
uniform sampler2D plu;
uniform highp usampler2D infos;

in vec3 tc;
flat in ivec4 params;
flat in pic_t picInfo;
flat in float trans;

out vec4 fragColor;

#define LOCAL_VIS (float((params.z + 16) & 0xff) / 16.0)
#define GLOBAL_VIS (float(globalVis))
#define DEPTH_SHADOW_SCALE (float(depthShadowScale))
#define GLOBAL_SHADOW (float(globalShadow))
#define LOCAL_SHADOW (float(params.x))
#define PAL (float(params.y))
#define DETPH_OFF (float(params.w))
#define PARALLAX (false)
#include "inc.fsh"


void main() {
  vec3 atlasTc = getTc(tc, picInfo, infos, atlas, vec4(0.0), false, false);
  vec3 color = palLookup(atlasTc, atlas, pal, plu);
  fragColor = vec4(color, trans);
}