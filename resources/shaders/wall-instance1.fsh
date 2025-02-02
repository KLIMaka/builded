precision highp float;

#include "structs.vsh"

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

uniform lowp sampler2DArray atlas;
uniform sampler2D pal;
uniform sampler2D plu;

in vec3 tc;
flat in ivec4 params;
flat in pic_t picInfo;

out vec4 fragColor;

#define LOCAL_VIS (1.0)
#define GLOBAL_VIS (512.0)
#define DEPTH_SHADOW_SCALE (1024.0)
#define GLOBAL_SHADOW (0.0)
#define LOCAL_SHADOW (float(params.x))
#define PLU_TEXTURE (plu)
#define PAL (float(params.y))
#define TRANSPARENCY (float(params.z)/255.0)
#define DETPH_OFF (float(params.w))
#include "inc.fsh"

vec3 getTc() {
  vec2 projectedTc = tc.xy / tc.z;
  vec2 off = picInfo.pos.xy / vec2(textureSize(atlas, 0));
  vec2 size = picInfo.sizeOff.xy / vec2(textureSize(atlas, 0));
  vec2 tcw = mod(mod(projectedTc, vec2(1.0, picInfo.nonpow2Wrap)),  vec2(1.0));
  return vec3(off + size * tcw, picInfo.pos.z);
}

vec3 palLookup(vec3 tc) {
  float colorIdx = texture(atlas, tc).r;
  float pluedIdx = samplePalIdx(colorIdx);
  if (isTransIdx(pluedIdx)) discard;
  return texture(pal, vec2(pluedIdx, 0.5)).rgb;
}

void main() {
  fragColor = vec4(palLookup(getTc()), TRANSPARENCY);
}
