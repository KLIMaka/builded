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
  float pluIdx = texture(plu, vec2(palIdx, off)).r;
  vec3 color = texture(pal, vec2(pluIdx, 0)).rgb;
  return color * overbright * lightOffset(lightLevel);
}


const float dith[4] = float[4](0.25, 0.75, 1.0, 0.5);
float getPalIdx(vec2 tc) {
  // vec2 size = vec2(textureSize(base, 0));
  // vec2 texel = 1.0 / size;
  // vec2 pixel = tc * size + 0.5;
  // vec2 frac = fract(pixel);
  // pixel = (floor(pixel) / size) - texel / 2.0;

  // float C11 = texture(base, fract(pixel + vec2( 0.0     , 0.0))).r;
  // float C21 = texture(base, fract(pixel + vec2( texel.x , 0.0))).r;
  // float C12 = texture(base, fract(pixel + vec2( 0.0     , texel.y))).r;
  // float C22 = texture(base, fract(pixel + vec2( texel.x , texel.y))).r;

  // float off = dith[(int(tc.y*size.y*4.0)%2)*2+ int(tc.x*size.x*4.0) % 2];
  // float x1 = frac.x < off ? C11 : C21;
  // float x2 = frac.x < off ? C12 : C22;
  // return frac.y < off ? x1 : x2;

  float palIdx = textureGrad(base, fract(tc), dFdx(tc), dFdy(tc)).r;
  return palIdx;
}

vec3 palLookup(vec2 tc) {
  float palIdx = getPalIdx(tc);
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
