precision highp float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform sampler2D grid;

uniform vec3 curpos;
uniform vec3 eyepos;
uniform vec4 clipPlane;
uniform vec4 sys;

uniform vec4 color;
uniform int shade;

varying vec4 tcps;
varying vec2 gridtc;
varying vec3 wpos;
varying vec3 wnormal;

const float trans = float(255.0/256.0);
const float PI = 3.1415926538;

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
  return (float(tcps.z) + lightLevel) / PALSWAPS;
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
  float pluIdx = texture2D(plu, vec2(palIdx, off)).r;
  vec3 color = texture2D(pal, vec2(pluIdx, 0)).rgb;
  return color * overbright * lightOffset(lightLevel);
}

vec3 palLookup(vec2 tc) {
  float palIdx = texture2D(base, fract(tc)).r;
  if (palIdx >= trans)
    discard;
  float lightLevel = clamp(lightOffset() + diffuse() + specular(), 0.5, SHADOWSTEPS - 0.5) / SHADOWSTEPS;
  float overbright = highlight();
  return sampleColor(palIdx, lightLevel, overbright);
}

void clip() {
  if (dot(wpos, clipPlane.xyz) + clipPlane.w > 0.0)
    discard;
}

void writeColor(vec3 c, vec4 m) {
  if (m.a == 0.0) discard;
  if (m.a < 0.0) gl_FragColor = vec4(vec3(m.rgb * c), (sin(sys.x / -m.a) + 1.0) / 2.0 );
  else gl_FragColor = vec4(vec3(m.rgb * c), m.a);
}

float foo(float x) {
  float v1 = fract(x);
  float v2 = 1.0 - fract(x);
  return pow(v1, 32.0)*2.0 + pow(v2, 32.0)*2.0;
}

vec4 renderGrid() {
  float x = foo(gridtc.x);
  float y = foo(gridtc.y);
  float c = x+y;
  return vec4(vec3(c), 0.1*c);
}

void main() {
  clip();
#if defined FLAT
  writeColor(vec3(1.0), color);
#elif defined PARALLAX
  vec3 toPixel = normalize(wpos - eyepos);
  float hang = (atan(toPixel.z, toPixel.x) + PI) / (2.0 * PI);
  float vang = (1.0 - toPixel.y) / 2.0;
  vec3 c = palLookup(vec2(hang, vang));
  writeColor(c, vec4(1.0));
#elif defined NORMAL
  writeColor(vec3((wnormal + 1.0) / 2.0), color);
#elif defined GRID
  vec4 grid1 = texture2D(grid, gridtc);
  writeColor(vec3(1.0), renderGrid());
#elif defined SPRITE_FACE
  writeColor(color.rgb, texture2D(base, tcps.xy));
#else
  writeColor(palLookup(tcps.xy), color);
#endif
}
