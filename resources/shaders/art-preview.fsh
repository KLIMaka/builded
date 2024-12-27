precision highp float;

#include "inc.fsh"

uniform sampler2D tex;
uniform sampler2D pal;
uniform sampler2D plu;
uniform sampler2D trans;
uniform vec4 options;

#define SUPER_SAMPLE (options.x > 0.0)
#define SUPER_SAMPLE_BLEND (options.x)
#define PALETTE (options.y)
#define REPEAT (options.z != 1.0)

in vec2 tc;

out vec4 fragColor;

const float TARANS_IDX = float(255.0/256.0);
const float PLU_LINES = SHADOWSTEPS * PALSWAPS;

bool isTransIdx(float idx) {
  return idx >= TARANS_IDX;
}

float palLightOffset(float lightLevel) {
  float base = PALETTE * SHADOWSTEPS;
  return  (base + lightLevel) / PLU_LINES;
}

float lightOffset(float lightLevel) {
  return 1.0;
}

float samplePaletteIndex(float idx, float palShadowOffset) {
  return texture(plu, vec2(idx, palShadowOffset)).r;
}

float transBlend(vec2 idxs) {
  return any(greaterThanEqual(idxs, vec2(TARANS_IDX)))
    ? ditherColors(gl_FragCoord.xy, idxs, 0.5)
    : texture(trans, idxs).r;
}

bool isBlendable(vec2 colors) {
  return any(greaterThanEqual(colors, vec2(TARANS_IDX)))
    ? false
    : abs(colors.x-colors.y) <= SUPER_SAMPLE_BLEND / 255.0;
}

vec3 sampleColor(vec3 palSamples, float lightLevel) {
  float off = palLightOffset(lightLevel + 0.5);
  vec3 idxs = vec3(
    samplePaletteIndex(palSamples.r, off),
    samplePaletteIndex(palSamples.g, off),
    samplePaletteIndex(palSamples.b, off)
  );
  bool blendable = isBlendable(idxs.gb);
  float idx = blendable
    ? transBlend(vec2(transBlend(idxs.gb), idxs.r))
    : idxs.r;
  if (isTransIdx(idx)) discard;
  vec3 color = texture(pal, vec2(idx, 0.5)).rgb;
  return color;
}

vec2 getTc(vec2 tc) {
  return REPEAT ? fract(tc) : tc;
}

vec3 getPalSamples(vec2 tc) {
  vec2 tcx = getTc(tc);
  return SUPER_SAMPLE 
    ? scale2xSample(tcx, tex)
    : vec3(texture(tex, tcx).r);
}

vec3 palLookup(vec2 tc) {
  vec3 palSamples = getPalSamples(tc);
  return sampleColor(palSamples, 1.0);
}

void main() {
  vec3 color = palLookup(tc);
  fragColor = vec4(color, 1.0);
}
