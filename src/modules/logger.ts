export const ERROR = 0;
export const WARN = 1;
export const INFO = 2;
export const TRACE = 3;
export const DEBUG = 4;

export type Appender = (level: number, ...msg: any) => void;

let appenders: Array<Appender> = [];

function write(level: number, ...msg: any) {
  for (let i = 0; i < appenders.length; i++) {
    appenders[i](level, ...msg);
  }
}

export const error = (...msg: any) => write(ERROR, ...msg);
export const warning = (...msg: any) => write(WARN, ...msg);
export const info = (...msg: any) => write(INFO, ...msg);
export const trace = (...msg: any) => write(TRACE, ...msg);
export const debug = (...msg: any) => write(DEBUG, ...msg);

export function addLogAppender(appender: Appender) {
  appenders.push(appender);
}

export const CONSOLE: Appender = (level: number, ...msg: any) => {
  switch (level) {
    case ERROR: console.error(...msg); return;
    case WARN: console.warn(...msg); return;
    case INFO: console.info(...msg); return;
    case TRACE: console.trace(...msg); return;
    case DEBUG: console.debug(...msg); return;
  }
}