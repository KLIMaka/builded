precision highp float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;

uniform vec3 curpos;
uniform vec3 eyepos;
uniform vec4 clipPlane;
uniform vec4 sys;
uniform vec4 grid;

uniform vec4 color;
uniform vec4 modulation;

in vec4 tcps;
in vec2 gridtc;
in vec3 wpos;
in vec3 wnormal;

out vec4 fragColor;

const float trans = float(255.0/256.0);
const float PI = 3.1415926538;
const float SQR2 = 1.414213562373095;

const float dith[16] = float[16](
  0.0   , 0.5   , 0.125 , 0.625 , 
  0.75  , 0.25  , 0.875 , 0.375 , 
  0.1875, 0.6875, 0.0625, 0.5625, 
  0.9375, 0.4375, 0.8125, 0.3125
);

vec2 ditherOffset() {
  int idx = int(gl_FragCoord.x) % 4 * 4 + int(gl_FragCoord.y) % 4;
  return  vec2(dith[idx], dith[15-idx]);
}


float lightOffset() {
#ifdef PARALLAX
  return 0.0;
#else
  float shadowLevel = length(wpos.xz - eyepos.xz) / 512.0 * (SHADOWSTEPS / 64.0);
  return (0.2 + float(tcps.w) / 127.0) * SHADOWSTEPS + shadowLevel;
#endif
}

float diffuse() {
#ifdef DIFFUSE
  vec3 toLight = normalize(curpos - wpos);
  float dist = distance(wpos, curpos);
  float ldot = dot(wnormal, toLight);
  if (dist < 4096.0 && ldot >= -0.001) {
    return -ldot * pow(1.0 - (dist / 4096.0), 1.0) * SHADOWSTEPS;
  }
#else
  return 0.0;
#endif
}

float specular() {
#ifdef SPECULAR
  vec3 toLight = normalize(curpos - wpos);
  vec3 r = reflect(-toLight, wnormal);
  float specular = pow(dot(r, normalize(eyepos - wpos)), 100.0);
  return -specular * SHADOWSTEPS;
#else
  return 0.0;
#endif
}

float highlight() {
  float dist = distance(wpos.xz, curpos.xz);
  if (dist < 16.0)
    return 2.0 + (sin(sys.x / 100.0) + 1.0);
  return 1.0;
}

float palLightOffset(float lightLevel) {
#ifdef PAL_LIGHTING
  return (tcps.z + (lightLevel) / SHADOWSTEPS) / PALSWAPS;
#else
  return (tcps.z + 0.5 / SHADOWSTEPS) / PALSWAPS ;
#endif
}

float lightOffset(float lightLevel) {
#if defined PAL_LIGHTING || defined PARALLAX
  return 1.0;
#else
  return 1.0 - lightLevel;
#endif
}

vec3 sampleColor(float palIdx, float lightLevel, float overbright) {
  float off = palLightOffset(lightLevel);
  float pluIdx = texture(plu, vec2(palIdx, off)).r;
  vec3 color = texture(pal, vec2(pluIdx, 0)).rgb;
  return color * overbright * lightOffset(lightLevel);
}

vec2 repeat(vec2 tc) {
#ifdef SPRITE
  return tc;
#else
  return fract(tc);
#endif
}

// float mip_map_level(in vec2 tc, vec2 size) {
//   vec2  dx_vtc = dFdx(tc * size / 4.0);
//   vec2  dy_vtc = dFdy(tc * size / 4.0);
//   float delta_max_sqr = max(dot(dx_vtc, dx_vtc), dot(dy_vtc, dy_vtc));
//   float mml = log2(delta_max_sqr);
//   return min(max(0.0, mml), log2(max(size.x, size.y)));
// }
float mip_map_level(in vec2 tc, vec2 size) {
  vec2  dx_vtc = dFdx(tc * size);
  vec2  dy_vtc = dFdy(tc * size);
  float delta_max_sqr = max(dot(dx_vtc, dx_vtc), dot(dy_vtc, dy_vtc));
  return max(0.0, 0.5 * log2(delta_max_sqr) + 1.0);
}

ivec2 irepeat(ivec2 tc, ivec2 size) {
#ifdef SPRITE
  return tc;
#else
  ivec2 m = tc % size;
  ivec2 neg = ivec2(lessThan(m, ivec2(0, 0)));
  return m + size * neg;
#endif
}

// float ditherSample(int lod, vec2 tc, float off) {
//   ivec2 isize = textureSize(base, lod);
//   vec2 size = vec2(isize);
//   vec2 center = tc * size + 0.5;
//   vec2 texel = 1.0 / size;
//   vec2 pixel = (floor(center) / size) - texel / 2.0;
//   vec2 frac = fract(center);
//   float C11 = textureGrad(base, repeat(pixel), dFdx(tc), dFdy(tc)).r;
//   float C21 = textureGrad(base, repeat(pixel + vec2(texel.x, 0)), dFdx(tc), dFdy(tc)).r;
//   float C12 = textureGrad(base, repeat(pixel + vec2(0, texel.y)), dFdx(tc), dFdy(tc)).r;
//   float C22 = textureGrad(base, repeat(pixel + vec2(texel.x, texel.y)), dFdx(tc), dFdy(tc)).r;


//   float x1 = frac.x < off ? C11 : C21;
//   float x2 = frac.x < off ? C12 : C22;
//   return frac.y < off ? x1 : x2;
// }

float ditherSample(int lod, vec2 tc, float off) {
  ivec2 isize = textureSize(base, lod);
  vec2 size = vec2(isize);
  vec2 center = tc * size + 0.5;
  vec2 texel = 1.0 / size;
  vec2 pixel = (floor(center) / size) - texel / 2.0;
  vec2 frac = fract(center);
  float C11 = textureGrad(base, repeat(pixel), dFdx(tc), dFdy(tc)).r;
  float C21 = textureGrad(base, repeat(pixel + vec2(texel.x, 0)), dFdx(tc), dFdy(tc)).r;
  float C12 = textureGrad(base, repeat(pixel + vec2(0, texel.y)), dFdx(tc), dFdy(tc)).r;
  float C22 = textureGrad(base, repeat(pixel + vec2(texel.x, texel.y)), dFdx(tc), dFdy(tc)).r;


  float nang = off * PI * 2.0;
  vec2 noise = vec2(0.5) + vec2(sin(nang), cos(nang)) * 0.4;
  float x1 = frac.x < noise.x ? C11 : C21;
  float x2 = frac.x < noise.x ? C12 : C22;
  return frac.y < noise.y ? x1 : x2;
}

float scale2xSample(float lod, vec2 tc, vec2 off) {
  ivec2 isize = textureSize(base, int(lod));
  vec2 size = vec2(isize);
  vec2 texel = 1.0 / size;
  vec2 center = tc * size;
  vec2 pixel = tc;
  vec2 frac = 0.5 - fract(center);

  float B = textureGrad(base, repeat(pixel + vec2(0.0, +texel.y)), dFdx(tc), dFdy(tc)).r;
  float D = textureGrad(base, repeat(pixel + vec2(-texel.x, 0.0)), dFdx(tc), dFdy(tc)).r;
  float E = textureGrad(base, repeat(pixel), dFdx(tc), dFdy(tc)).r;
  float E1 = textureGrad(base, repeat(pixel), dFdx(tc) / 2.0, dFdy(tc) / 2.0).r;
  float F = textureGrad(base, repeat(pixel + vec2(+texel.x, 0.0)), dFdx(tc), dFdy(tc)).r;
  float H = textureGrad(base, repeat(pixel + vec2(0.0, -texel.y)), dFdx(tc), dFdy(tc)).r;


  vec4 A = vec4(
    B == D ? B : E,
    B == F ? B : E,
    H == D ? H : E,
    H == F ? H : E
  );

  // float nang = off.x * PI * 2.0;
  // vec2 noise = vec2(sin(nang), cos(nang));
  // vec2 noisefrac = frac + noise * 0.5;
  vec2 noisefrac = frac;
  float x1 = noisefrac.x < 0.0 ? A.w : A.z;
  float x2 = noisefrac.x < 0.0 ? A.y : A.x;
  // return fract(lod) - 0.2 < off.x ? noisefrac.y > 0.0 ? x1 : x2 : E1;
  return  noisefrac.y > 0.0 ? x1 : x2;
}

float getPalIdx(vec2 tc) {
  float lod = mip_map_level(tc, vec2(textureSize(base, 0)));
#ifdef DITHERING
  int ilod = int(lod);
  float doff = ditherOffset();
  float result = ditherSample(ilod, tc, doff);
  if (ilod > 0) {
    result = fract(lod) < doff ? ditherSample(ilod - 1, tc, doff) : result;
  }
  return result;
#else
  // return textureGrad(base, repeat(tc), dFdx(tc), dFdy(tc)).r;
  // return ditherSample(int(lod), tc, ditherOffset());
  return scale2xSample(lod, tc, ditherOffset());
#endif
}

vec3 palLookup(vec2 tc) {
  float palIdx = getPalIdx(tc);
  if (palIdx >= trans) discard;
  float lterm = lightOffset() + diffuse() + specular();
  float lightLevel = clamp(lterm + (fract(lterm) > ditherOffset().x ? 1.0 : 0.0), 1.0 / SHADOWSTEPS, SHADOWSTEPS - 1.0 / SHADOWSTEPS);
  float overbright = highlight();
  return sampleColor(palIdx, lightLevel, overbright);
}

void clip() {
  if (dot(wpos, clipPlane.xyz) + clipPlane.w > 0.0) discard;
}

void writeColor(vec3 c, vec4 m) {
  if (m.a == 0.0) discard;
  if (m.a < 0.0) fragColor = vec4(vec3(m.rgb * c), (sin(sys.x / -m.a) + 1.0) / 2.0);
  else fragColor = vec4(vec3(m.rgb * c), m.a);
}

vec4 renderGrid() {
  vec2 coord = gridtc.xy / grid.x;
  vec2 gridDet = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = min(gridDet.x, gridDet.y);
  float a = 1.0 - min(line, 1.0);
  float dist = 1.0 - pow(smoothstep(0.0, grid.x * grid.y, length(curpos - wpos)), 32.0);
  return vec4(0.4, 0.4, 0.4, a * dist);
}

void main() {
  clip();
#if defined FLAT
  writeColor(vec3(1.0), color * modulation);
#elif defined PARALLAX
  vec3 toPixel = normalize(wpos - eyepos);
  float hang = (atan(toPixel.z, toPixel.x) + PI) / (2.0 * PI);
  float vang = (1.0 - toPixel.y) / 2.0;
  vec3 c = palLookup(vec2(hang, vang));
  writeColor(c, vec4(1.0));
#elif defined NORMAL
  writeColor(vec3((wnormal + 1.0) / 2.0), color);
#elif defined GRID
  writeColor(vec3(1.0), renderGrid());
#elif defined SPRITE_FACE
  writeColor(color.rgb, texture(base, tcps.xy));
#else
  writeColor(palLookup(tcps.xy), color);
#endif
}
