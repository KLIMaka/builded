import { Handle, LogHandler, LogLevel, Logger } from "../../../apis/app1";

class LoggerImpl implements Logger {
  private handlers: Set<LogHandler> = new Set();

  log(level: LogLevel, ...msg: any[]): void {
    this.handlers.forEach(h => h(level, msg));
  }

  addHandler(handler: LogHandler): Handle {
    this.handlers.add(handler);
    const remove = () => this.handlers.delete(handler);
    return { remove };
  }
}

export function DefaultLogger() {
  const logger = new LoggerImpl();
  logger.addHandler((level: LogLevel, ...msg: any[]) => {
    switch (level) {
      case 'ERROR': console.error(...msg); break;
      case 'WARN': console.warn(...msg); break;
      case 'INFO': console.info(...msg); break;
      case 'TRACE': console.trace(...msg); break;
      case 'DEBUG': console.debug(...msg); break;
    }
  });
  return logger;
}