precision highp float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;

uniform vec3 curpos;
uniform vec3 eyepos;
uniform vec4 clipPlane;
uniform vec4 sys;
uniform vec4 sys1;

uniform vec4 color;
uniform vec4 modulation;

in vec4 tcps;
in vec2 gridtc;
in vec3 wpos;
in vec3 wnormal;

out vec4 fragColor;

const float trans = float(255.0/256.0);
const float PI = 3.1415926538;

const float dith[16] = float[16](
  0.0   , 0.5   , 0.125 , 0.625 , 
  0.75  , 0.25  , 0.875 , 0.375 , 
  0.1875, 0.6875, 0.0625, 0.5625, 
  0.9375, 0.4375, 0.8125, 0.3125
);
float ditherOffset() {
  return  dith[int(gl_FragCoord.x) % 4 * 4 + int(gl_FragCoord.y) % 4];
}

float lightOffset() {
  float shadowLevel = length(wpos.xz - eyepos.xz) / 512.0 * (SHADOWSTEPS / 64.0);
  return (0.2 + float(tcps.w) / 127.0) * SHADOWSTEPS + shadowLevel;
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
  return (float(tcps.z) + lightLevel / SHADOWSTEPS) / PALSWAPS;
#else
  return (float(tcps.z) + 0.5 / SHADOWSTEPS) / PALSWAPS ;
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
  float pluIdx = texture(plu, vec2(palIdx + 0.5 / 256.0, off)).r;
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

float mip_map_level(in vec2 tc, vec2 size) {
  vec2  dx_vtc = dFdx(tc * size / 4.0);
  vec2  dy_vtc = dFdy(tc * size / 4.0);
  float delta_max_sqr = max(dot(dx_vtc, dx_vtc), dot(dy_vtc, dy_vtc));
  float mml = log2(delta_max_sqr);
  return min(max(0.0, mml), log2(max(size.x, size.y)));
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
//   ivec2 pixel = ivec2(center);
//   vec2 frac = fract(center);
//   float C11 = texelFetch(base, irepeat(pixel, isize), lod).r;
//   float C21 = texelFetch(base, irepeat(pixel + ivec2(1, 0), isize), lod).r;
//   float C12 = texelFetch(base, irepeat(pixel + ivec2(0, 1), isize), lod).r;
//   float C22 = texelFetch(base, irepeat(pixel + ivec2(1, 1), isize), lod).r;
//   float x1 = frac.x < off ? C11 : C21;
//   float x2 = frac.x < off ? C12 : C22;
//   return frac.y < off ? x1 : x2;
// }

float ditherSample(vec2 tc, float off) {
  ivec2 isize = textureSize(base, int(mip_map_level(tc, vec2(textureSize(base, 0)))));
  vec2 size = vec2(isize);
  vec2 center = tc * size + 0.5;
  vec2 texel = 1.0 / size;
  vec2 pixel = (floor(center) / size) - texel / 2.0;
  vec2 frac = fract(center);
  float C11 = textureGrad(base, repeat(pixel), dFdx(tc), dFdy(tc)).r;
  float C21 = textureGrad(base, repeat(pixel + vec2(texel.x, 0)), dFdx(tc), dFdy(tc)).r;
  float C12 = textureGrad(base, repeat(pixel + vec2(0, texel.y)), dFdx(tc), dFdy(tc)).r;
  float C22 = textureGrad(base, repeat(pixel + vec2(texel.x, texel.y)), dFdx(tc), dFdy(tc)).r;
  float x1 = frac.x < off ? C11 : C21;
  float x2 = frac.x < off ? C12 : C22;
  return frac.y < off ? x1 : x2;
}

float getPalIdx(vec2 tc) {
#ifdef DITHERING
  float lod = mip_map_level(tc, vec2(textureSize(base, 0)));
  int ilod = int(lod);
  float doff = ditherOffset();
  float result = ditherSample(ilod, tc, doff);
  if (ilod > 0) {
    result = fract(lod) < doff ? ditherSample(ilod - 1, tc, doff) : result;
  }
  return result;
#else
  // return textureGrad(base, repeat(tc), dFdx(tc), dFdy(tc)).r;
  return ditherSample(tc, ditherOffset());
#endif
}

vec3 palLookup(vec2 tc) {
  float palIdx = getPalIdx(tc);
  if (palIdx >= trans) discard;
  float lterm = lightOffset() + diffuse() + specular();
  float lightLevel = clamp(lterm + (fract(lterm) > ditherOffset() ? 1.0 : 0.0), 0.0, SHADOWSTEPS);
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
  vec2 coord = gridtc.xy / sys1.x;
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = min(grid.x, grid.y);
  float a = 1.0 - min(line, 1.0);
  return vec4(0.4, 0.4, 0.4, a);
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
