#include "dither-inc.fsh"

const float TARANS_IDX = 255.0 / 256.0;
const float PLU_LINES = SHADOWSTEPS * PALSWAPS;
const float DEFAULT_VIS = 512.0;

bool isTransIdx(float idx) {
  return idx >= TARANS_IDX;
}

ivec2 clampTc(ivec2 tc, ivec2 size) {
  return clamp(tc, ivec2(0), size - ivec2(1));
}

vec3 scale2xSample(vec2 tc, sampler2D tex) {
  vec2 size = vec2(textureSize(tex, 0));
  ivec2 isize = ivec2(size);
  ivec2 pixel = ivec2(tc * size);
  vec2 frac = floor(2.0 * fract(tc * size));
  ivec2 off1 = ivec2(frac.x == 0.0 ? -1 : 1, 0);
  ivec2 off2 = ivec2(0, frac.y == 0.0 ? -1 : 1);
  float ORIG = texelFetch(tex, clampTc(pixel, isize), 0).r;
  float ADD1 = texelFetch(tex, clampTc(pixel + off1, isize), 0).r;
  float ADD2 = texelFetch(tex, clampTc(pixel + off2, isize), 0).r;
  return vec3(ORIG, ADD1, ADD2);
}

float depth() {
  return 1.0 / gl_FragCoord.w;
}

float calcShadow() {
  float atten = DEFAULT_VIS / (GLOBAL_VIS * LOCAL_VIS);
  float depthOff = PARALLAX ? 0.0 : (depth() / (atten * DEPTH_SHADOW_SCALE));
  float shadow = GLOBAL_SHADOW + LOCAL_SHADOW + depthOff;
  int dither = fract(shadow) > ditherOffset(gl_FragCoord.xy) ? 1 : 0;
  float shadowDithered = float(int(shadow) + dither);
  return clamp(shadowDithered, 0.0, SHADOWSTEPS - 1.0);
}

float pluOffset(float shadow) {
  float palOff = PAL * SHADOWSTEPS;
  return  (palOff + shadow) / PLU_LINES;
}

float samplePalIdx(sampler2D plu, float colorIdx) {
  float off = pluOffset(calcShadow());
  return texture(plu, vec2(colorIdx, off)).r;
}

vec3 getParallaxTc(vec4 parallax) {
  vec3 toPixel = normalize(parallax.xyz);
  float hang = (PI - atan(-toPixel.z, toPixel.x)) / (2.0 * PI);
  float vang = (1.0 - toPixel.y) / 2.0;
  float scaledHang = hang * float(parallaxPics);
  return vec3(fract(scaledHang), vang, trunc(scaledHang));
}

pic_t getActualPicInfo(pic_t picInfo, highp usampler2D infos, bool isParallax, vec3 tc) {
  if (!isParallax) return picInfo;
  if (picInfo.parallax == uint(0)) return picInfo;
  uint picOff = uint(tc.z);
  if (picOff == uint(0)) return picInfo;
  if (picInfo.parallax == uint(0xffffff)) return loadPicInfo(infos, picInfo.picnum + picOff, 0.0);
  uint picOff2 = (picInfo.parallax >> ((picOff - uint(1)) * uint(3))) & uint(0x7);
  return loadPicInfo(infos, picInfo.picnum + picOff2, 0.0);
}

vec3 getTc(vec3 tc, pic_t picInfo, highp usampler2D infos,lowp sampler2DArray atlas, vec4 parallax, bool applyNonpow2Wrap, bool applyFract) {
  bool isParallax = parallax.w == 1.0;
  vec3 projectedTc = isParallax ? getParallaxTc(parallax) : vec3(tc.xy / tc.z, 0.0);
  pic_t actualPicInfo = getActualPicInfo(picInfo, infos, isParallax, projectedTc);
  vec2 off = (actualPicInfo.pos.xy + vec2(0.01)) / vec2(textureSize(atlas, 0));
  vec2 size = (actualPicInfo.sizeOff.xy - vec2(0.02)) / vec2(textureSize(atlas, 0));
  vec2 tcw = !applyFract
    ? projectedTc.xy
    : (applyNonpow2Wrap
      ? mod(mod(projectedTc.xy, vec2(1.0, actualPicInfo.nonpow2Wrap)),  vec2(1.0))
      : fract(projectedTc.xy));
  return vec3(clamp(off + size * tcw, off, off + size), actualPicInfo.pos.z);
}

vec3 fetchColor(sampler2D pal, float pluedIdx) {
  return texture(pal, vec2(pluedIdx, 0.5)).rgb;
}

vec3 palLookup(vec3 tc, lowp sampler2DArray atlas, sampler2D pal, sampler2D plu) {
  float colorIdx = texture(atlas, tc).r;
  float pluedIdx = samplePalIdx(plu, colorIdx);
  if (isTransIdx(pluedIdx)) discard;
  return fetchColor(pal, pluedIdx).rgb;
}
