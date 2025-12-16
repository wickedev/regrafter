/**
 * Logger utility for controlled logging
 *
 * Provides logging capabilities that can be controlled by environment variables
 * and disabled in production builds.
 */

/**
 * Logger class for controlled logging output
 */
export class Logger {
  private readonly context: string;
  private readonly enabled: boolean;

  constructor(context = 'Regrafter', enabled = true) {
    this.context = context;
    this.enabled = enabled && process.env.NODE_ENV !== 'production';
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.context}] ${message}`);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.error(`[${this.context}] ${message}`, error ?? '');
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.info(`[${this.context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    if (this.enabled && process.env.DEBUG) {
      // eslint-disable-next-line no-console
      console.debug(`[${this.context}] ${message}`);
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context = 'Regrafter', enabled = true): Logger {
  return new Logger(context, enabled);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
