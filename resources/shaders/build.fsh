precision highp float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;

uniform vec3 curpos;
uniform vec3 eyepos;
uniform vec4 clipPlane;
uniform vec4 sys;
uniform vec4 sys1;
uniform vec4 grid;
uniform vec4 color;
uniform vec4 modulation;
uniform vec4 tcwrap;
uniform float vis;

in vec4 tcps;
in vec2 gridtc;
in vec3 wpos;
in vec4 wnormal;
in vec4 lm;

out vec4 fragColor;

#define TC (tcps.xy)
#define PAL (tcps.z >= PALSWAPS ? 0.0 : tcps.z)
#define SCREEN (sys.yz)
#define TIME (sys.x)
#define DETPH_OFF (wnormal.w)
#define WRAP (tcwrap.xy)
#define GRID_SIZE (grid.x)
#define GRID_RANGE (grid.y)
#define GLOBAL_SHADOW (sys1.x)
#define LOCAL_SHADOW (tcps.w)
#ifdef PARALLAX
#define DEPTH_SHADOW_SCALE (9.0e27)
#else 
#define DEPTH_SHADOW_SCALE (1024.0)
#endif
#define GLOBAL_VIS (sys.w)
#define LOCAL_VIS (vis)
#define PLU_TEXTURE (plu)

#include "inc.fsh"

float highlight() {
  float dist = distance(wpos.xz, curpos.xz);
  if (dist < 16.0)
    return 2.0 + (sin(TIME / 100.0) + 1.0);
  return 1.0;
}

vec2 repeat(vec2 tc) {
#if defined(SPRITE) || defined(NONREPEAT)
  return tc;
#else
  return mod(mod(tc, WRAP),  vec2(1.0));
#endif
}

vec3 palLookup(vec2 tc) {
  float colorIdx = texture(base, repeat(tc)).r;
  float pluedIdx = samplePalIdx(colorIdx);
  if (isTransIdx(pluedIdx)) discard;
  return texture(pal, vec2(pluedIdx, 0.5)).rgb * highlight();
}

void clip() {
  if (dot(wpos, clipPlane.xyz) + clipPlane.w > 0.0) discard;
}

void writeColor(vec3 c, vec4 m) {
  if (m.a == 0.0) discard;
  if (m.a < 0.0) fragColor = vec4(vec3(m.rgb * c), (sin(TIME / -m.a) + 1.0) / 2.0);
  else fragColor = vec4(vec3(m.rgb * c), m.a);
}

vec4 renderGrid() {
  // vec2 coord = gridtc / GRID_SIZE;
  // vec2 gridDet = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  // vec2 coord2 = coord / 4.0;
  // vec2 gridDet2 = abs(fract(coord2 - 0.5) - 0.5) / fwidth(coord2);
  // float line = min(gridDet.x, gridDet.y);
  // float line2 = min(gridDet2.x, gridDet2.y);
  // float a = 1.0 - min(line, 1.0);
  // float b = 1.0 - min(line2, 1.0);
  // float dist = 1.0 - pow(smoothstep(0.0, GRID_SIZE * GRID_RANGE, length(curpos - wpos)), 32.0);
  // // return vec4(0.4, 0.4, 0.4, a * dist) + vec4(0.4, 0.6, 0.4, b * dist);
  // // return  vec4(0.4, 0.6, 0.4, b * dist);
  // return b > 0.0 ? vec4(0.984, 0.78, 0.118, b * dist) : vec4(0.4, 0.4, 0.4, a * dist);
  
  vec2 coord = gridtc / (GRID_SIZE * 2.0);
  bvec2 odd = greaterThan(fract(coord - 0.5), vec2(0.5));
  // return vec4(0.984, 0.78, 0.118, odd.x ^^ odd.y ? 0.1 : 0.0 );
  return vec4(1.0, 1.0, 1.0, odd.x ^^ odd.y ? 0.1 : 0.0);
}

void addDepth(float dd) {
  float originalZ = 1.0 / gl_FragCoord.w;
  float z = originalZ - dd * originalZ;
  gl_FragDepth = 0.5 * ((z - 2.0) / z) + 0.5;
}

void main() {
  clip();

#ifdef ADD_DEPTH
  addDepth(DETPH_OFF);
#endif

#if defined FLAT
  writeColor(vec3(1.0), color * modulation);
#elif defined PARALLAX
  vec3 toPixel = normalize(wpos - eyepos);
  float hang = 0.5 + (PI - atan(-toPixel.z, toPixel.x)) / (2.0 * PI);
  float vang = (1.0 - toPixel.y) / 2.0;
  vec3 c = palLookup(vec2(hang, vang));
  writeColor(c, vec4(1.0));
#elif defined NORMAL
  writeColor(vec3((wnormal.xyz + 1.0) / 2.0), color);
#elif defined GRID
  writeColor(vec3(1.0), renderGrid());
#elif defined SPRITE_FACE
  writeColor(color.rgb, texture(base, TC));
#elif defined SPRITE
  writeColor(palLookup(TC), color);
#elif defined VOXEL
  float idx = samplePalIdx(tcps.x);
  vec3 palColor = texture(pal, vec2(idx, 0.5)).rgb;
  writeColor(palColor, color);
#else
  writeColor(palLookup(TC), color);
  // vec4 lm1 = fract(lm / 2.0);
  // fragColor = vec4(vec3(lm1.x > 0.5 && lm1.y > 0.5 || lm1.x <= 0.5 && lm1.y <= 0.5 ? 0.7 : 0.3), 1.0);
#endif
}
