precision highp float;

uniform sampler2D tex;
uniform vec4 options;
uniform mat3 homo;
uniform vec4 size;

in vec2 tc;

out vec4 fragColor;

void main() {
  vec3 ntc = homo * vec3(tc * size.zw, 1.0);
  fragColor = texture(tex, (ntc.xy / ntc.z) / size.zw);
}
