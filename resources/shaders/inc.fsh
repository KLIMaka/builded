
const float dith[16] = float[16](
  0.0   , 0.5   , 0.125 , 0.625 , 
  0.75  , 0.25  , 0.875 , 0.375 , 
  0.1875, 0.6875, 0.0625, 0.5625, 
  0.9375, 0.4375, 0.8125, 0.3125
);

float ditherOffset(vec2 xy) {
  int idx = int(xy.x) % 4 * 4 + int(xy.y) % 4;
  return dith[idx];
}

float ditherColors(vec2 xy, vec2 colors, float t) {
  float off = ditherOffset(xy);
  return colors.x > colors.y 
    ? off >= t ? colors.x : colors.y 
    : off >= t ? colors.y : colors.x;
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
