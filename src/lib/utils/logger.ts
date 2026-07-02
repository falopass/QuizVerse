type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

function createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
}

const logger = {
  info(message: string, data?: unknown) {
    const entry = createLogEntry('info', message, data);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[LOG:${entry.level}] ${entry.message}`, entry.data ?? '');
    }
  },
  warn(message: string, data?: unknown) {
    const entry = createLogEntry('warn', message, data);

    console.warn(`[LOG:${entry.level}] ${entry.message}`, entry.data ?? '');
  },
  error(message: string, error?: unknown) {
    const entry = createLogEntry('error', message, error);

    console.error(`[LOG:${entry.level}] ${entry.message}`, entry.data ?? '');
  },
};

export { logger };
