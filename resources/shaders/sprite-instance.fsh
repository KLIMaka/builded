precision highp float;

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
flat in uvec4 picInfo;

out vec4 fragColor;

#define LOCAL_VIS (1.0)
#define GLOBAL_VIS (512.0)
#define DEPTH_SHADOW_SCALE (32.0)
#define GLOBAL_SHADOW (0.0)
#define LOCAL_SHADOW (float(params.y))
#define PLU_TEXTURE (plu)
#define PAL (float(params.x))
#define TRANSPARENCY (float(params.z)/255.0)
#define DETPH_OFF (float(params.w))
#include "inc.fsh"

int ubyte2byte(uint x) { return int(x) <= 127 ? int(x) : int(x) - 256; }

#define ATLAS_X (picInfo.y & uint(0xffff))
#define ATLAS_Y ((picInfo.y >> 16) & uint(0xffff))
#define ATLAS_Z (picInfo.z)
#define PIC_W (picInfo.x & uint(0xffff))
#define PIC_H ((picInfo.x >> 16) & uint(0xffff))
#define PIC_FRAMES (picInfo.w & uint(0x3f))
#define PIC_ANIM_TYPE ((picInfo.w >> 6) & uint(0x3))
#define PIC_X ((ubyte2byte(picInfo.w >> 8) & uint(0xff)))
#define PIC_Y ((ubyte2byte(picInfo.w >> 16) & uint(0xff)))
#define PIC_ANIM_SPEED ((picInfo.w >> 24) & uint(0xf))
#define PIC_TYPE ((picInfo.w >> 28) & uint(0xf))

vec3 getTc() {
  vec2 projectedTc = tc.xy / tc.z;
  vec2 off = (vec2(ATLAS_X, ATLAS_Y) + vec2(0.01)) / vec2(textureSize(atlas, 0));
  vec2 size = (vec2(PIC_W, PIC_H) - vec2(0.02)) / vec2(textureSize(atlas, 0));
  return vec3(clamp(off + size * projectedTc, off, off + size), ATLAS_Z);
}

vec3 palLookup(vec3 tc) {
  float colorIdx = texture(atlas, tc).r;
  float pluedIdx = samplePalIdx(colorIdx);
  if (isTransIdx(pluedIdx)) discard;
  return texture(pal, vec2(pluedIdx, 0.5)).rgb;
}

void main() {
  vec3 tc = getTc();
  fragColor = vec4(palLookup(tc), TRANSPARENCY);
}