precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

uniform sampler2D pal;
uniform sampler2D plu;

flat in ivec4 params;
flat in uint color;

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
  vec3 color = fetchColor(pal, samplePalIdx(plu, float(color) / 255.0));
  fragColor = vec4(color, 1.0);
}