precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

uniform sampler2D tex;
uniform sampler2D pal;
uniform sampler2D plu;

in vec3 tc;
flat in ivec4 params;

out vec4 fragColor;

#define LOCAL_VIS (1.0)
#define GLOBAL_VIS (512.0)
#define DEPTH_SHADOW_SCALE (32.0)
#define GLOBAL_SHADOW (0.0)
#define LOCAL_SHADOW (float(params.x))
#define PLU_TEXTURE (plu)
#define PAL (float(params.y))
#define TRANSPARENCY (float(params.z)/255.0)
#define DETPH_OFF (float(params.w))

#include "inc.fsh"

void addDepth(float dd) {
  float originalZ = 1.0 / gl_FragCoord.w;
  float z = originalZ - dd * originalZ;
  gl_FragDepth = 0.5 * ((z - 2.0) / z) + 0.5;
}

vec3 palLookup(vec3 tc) {
  float colorIdx = textureProj(tex, tc).r;
  float pluedIdx = samplePalIdx(colorIdx);
  if (isTransIdx(pluedIdx)) discard;
  return texture(pal, vec2(pluedIdx, 0.5)).rgb;
}

void main() {
  fragColor = vec4(palLookup(tc), TRANSPARENCY);
#ifdef ADD_DEPTH
  addDepth(DETPH_OFF);
#endif
}
