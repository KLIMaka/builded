import MU = require('../libs/mathutils');

export function rand0(to:number):number {
  return Math.random()*to;
}

export function randInt0(to:number):number {
  return MU.int(Math.random()*(to+1));
}

export function rand(from:number, to:number):number {
  return from + Math.random()*(to-from);
}

export function randInt(from:number, to:number):number {
  return MU.int(from + Math.random()*(to-from+1));
}

export function coin():boolean {
  return Math.random() > 0.5;
}

