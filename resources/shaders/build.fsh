precision highp float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform sampler2D trans;

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
in vec4 lm;

out vec4 fragColor;

const float TARANS_IDX = float(255.0/256.0);
const float PI = 3.1415926538;
const float SQR2 = 1.414213562373095;
const float PLU_LINES = SHADOWSTEPS * PALSWAPS;

bool isTransIdx(float idx) {
  return idx >= TARANS_IDX;
}

const float dith[16] = float[16](
  0.0   , 0.5   , 0.125 , 0.625 , 
  0.75  , 0.25  , 0.875 , 0.375 , 
  0.1875, 0.6875, 0.0625, 0.5625, 
  0.9375, 0.4375, 0.8125, 0.3125
);

float ditherOffset() {
  int idx = int(gl_FragCoord.x) % 4 * 4 + int(gl_FragCoord.y) % 4;
  return dith[idx];
}

float ditherColors(vec2 c, float d) {
  float off = ditherOffset();
  return c.x > c.y 
    ? off >= d ? c.x : c.y 
    : off >= d ? c.y : c.x;
}

float lightOffset() {
#ifdef PARALLAX
  return 0.0;
#else
  float z = (1.0 / gl_FragCoord.w) ;
  float atten = 1.0 / (clamp(sys.w, 1.0 / 4096.0, 4096.0) / 4096.0) * 125.0;
  float shadowLevel =  z / atten;
  return tcps.w + shadowLevel;
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
  float base = tcps.z * SHADOWSTEPS;
  return  (base + lightLevel) / PLU_LINES;
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

float samplePaletteIndex(float idx, float palShadowOffset) {
  return texture(plu, vec2(idx, palShadowOffset)).r;
}

float transBlend(vec2 idxs) {
  return any(greaterThanEqual(idxs, vec2(TARANS_IDX)))
    ? ditherColors(idxs, 0.5)
    : texture(trans, idxs).r;
}

vec3 sampleColor(vec3 palSamples, float lightLevel, float overbright) {
  float off = palLightOffset(lightLevel + 0.5);
  vec3 idxs = vec3(
    samplePaletteIndex(palSamples.r, off),
    samplePaletteIndex(palSamples.g, off),
    samplePaletteIndex(palSamples.b, off)
  );
  float idx = abs(idxs.g-idxs.b) <= 4.0 / 256.0
    ? transBlend(vec2(transBlend(idxs.gb), idxs.r))
    : idxs.r;
  if (isTransIdx(idx)) discard;
  vec3 color = texture(pal, vec2(idx, 0.5)).rgb;
  return color * overbright * lightOffset(lightLevel);
}

vec2 repeat(vec2 tc) {
#ifdef SPRITE
  return tc;
#else
  return fract(tc);
#endif
}

float mipLevel(in vec2 tc, vec2 size) {
  vec2  dx_vtc = dFdx(tc * size);
  vec2  dy_vtc = dFdy(tc * size);
  float delta_max_sqr = max(dot(dx_vtc, dx_vtc), dot(dy_vtc, dy_vtc));
  return max(0.0, 0.5 * log2(delta_max_sqr) + 1.0);
}

vec3 scale2xSample(vec2 tc) {
  vec2 pixel = repeat(tc);
  vec2 dx = dFdx(tc);
  vec2 dy = dFdy(tc);
  
  vec2 size = vec2(textureSize(base, 0));
  vec2 frac = floor(2.0 * fract(tc * size));
  float ORIG = textureGrad(base, pixel, dx, dy).r;
  float ADD1 = frac.x == 0.0
    ? textureGradOffset(base, pixel, dx, dy, ivec2(-1, 0)).r
    : textureGradOffset(base, pixel, dx, dy, ivec2(+1, 0)).r;
  float ADD2 = frac.y == 0.0
    ? textureGradOffset(base, pixel, dx, dy, ivec2(0, -1)).r
    : textureGradOffset(base, pixel, dx, dy, ivec2(0, +1)).r;

  return vec3(ORIG, ADD1, ADD2);
}

vec3 getPalSamples(vec2 tc) {
  return mipLevel(tc, vec2(textureSize(base, 0))) > 0.0 
    ? vec3(textureGrad(base, repeat(tc), dFdx(tc), dFdy(tc)).r) 
    : scale2xSample(tc);
}

vec3 palLookup(vec2 tc) {
  vec3 palSamples = getPalSamples(tc);
  float lterm = lightOffset() + diffuse() + specular();
  int dither = fract(lterm) > ditherOffset() ? 1 : 0;
  float lightLevel = clamp(float(int(lterm) + dither), 0.0, SHADOWSTEPS - 1.0);
  float overbright = highlight();
  return sampleColor(palSamples, lightLevel, overbright);
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

void addDepth(float dd) {
  float z = 1.0 / gl_FragCoord.w - dd;
  gl_FragDepth = 0.5*((z - 2.0) / z) + 0.5;
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
#elif defined SPRITE
  addDepth(128.0);
  writeColor(palLookup(tcps.xy), color);
#else
  writeColor(palLookup(tcps.xy), color);
  // vec4 lm1 = fract(lm / 2.0);
  // fragColor = vec4(vec3(lm1.x > 0.5 && lm1.y > 0.5 || lm1.x <= 0.5 && lm1.y <= 0.5 ? 0.7 : 0.3), 1.0);
#endif
}
