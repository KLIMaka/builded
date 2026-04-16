uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

uniform Engine {
  int globalShadow;
  int globalVis;
  int depthShadowScale;
  float time;
  uint parallaxPics;
  uint grid;
  vec2 screenSize;
};

vec3 curpos() {
  return (IV * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
}

vec3 forward() {
  return (IV * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
}

vec3 leftSide() {
  return -(IV * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
}

