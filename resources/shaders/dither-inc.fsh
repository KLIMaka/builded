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