
export interface InputState {
  readonly keys: { [index: string]: boolean };
  readonly keysPress: { [index: string]: boolean };
  readonly mouseButtons: [boolean, boolean, boolean];
  readonly mouseClicks: [boolean, boolean, boolean];
  readonly mouseX: number;
  readonly mouseY: number;
  readonly wheel: number;
}

let named = {
  8: 'BACKSPACE',
  9: 'TAB',
  13: 'ENTER',
  16: 'SHIFT',
  27: 'ESCAPE',
  32: 'SPACE',
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  45: 'INSERT',
  46: 'DELETE'
};

function mapKeyCode(code: number): string {
  return named[code] || (code >= 65 && code <= 90 ? String.fromCharCode(code) : null);
}

const state = {
  keys: {},
  keysPress: {},
  mouseButtons: <[boolean, boolean, boolean]>[false, false, false],
  mouseClicks: <[boolean, boolean, boolean]>[false, false, false],
  mouseX: 0,
  mouseY: 0,
  wheel: 0
}

export function postFrame() {
  state.wheel = 0;
  state.mouseClicks[0] = false;
  state.mouseClicks[1] = false;
  state.mouseClicks[2] = false;
  state.keysPress = {};
}

export function bind(canvas: HTMLCanvasElement) {
  canvas.addEventListener('mousemove', (e: MouseEvent) => mousemove(e));
  canvas.addEventListener('mouseup', (e: MouseEvent) => mouseup(e));
  canvas.addEventListener('mousedown', (e: MouseEvent) => mousedown(e));
  canvas.addEventListener('wheel', (e: WheelEvent) => wheelevent(e));
  document.addEventListener('keyup', (e: KeyboardEvent) => keyup(e));
  document.addEventListener('keydown', (e: KeyboardEvent) => keydown(e));
}

function updateState(keys: { [index: string]: boolean }, e: KeyboardEvent, state: boolean) {
  keys['ALT'] = e.altKey;
  keys['SHIFT'] = e.shiftKey;
  keys['CTRL'] = e.ctrlKey;
  let key = mapKeyCode(e.keyCode);
  if (key) keys[key] = state;
  keys[e.keyCode] = state;
  keys[e.key] = state;
}

function keydown(e: KeyboardEvent) {
  updateState(state.keys, e, true);
  updateState(state.keysPress, e, true);
  e.preventDefault();
  return false;
}

function keyup(e: KeyboardEvent) {
  updateState(state.keys, e, false);
  e.preventDefault();
  return false;
}

function mousemove(e: MouseEvent): boolean {
  state.mouseX = e.offsetX;
  state.mouseY = e.offsetY;
  return false;
}

function mouseup(e: MouseEvent): boolean {
  state.mouseButtons[e.button] = false;
  state.mouseClicks[e.button] = true;
  return false;
}

function mousedown(e: MouseEvent): boolean {
  state.mouseButtons[e.button] = true;
  return false;
}

function wheelevent(e: WheelEvent): boolean {
  state.wheel = e.deltaY > 0 ? 1 : -1;
  return false;
}

export function get(): InputState {
  return state;
}
