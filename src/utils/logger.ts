/**
 * Logger utility for controlled logging
 *
 * Provides logging capabilities that can be controlled by environment variables
 * and disabled in production builds.
 */

/**
 * Interface for log output handlers
 */
export interface LogOutput {
  warn(message: string): void;
  error(message: string, error?: string): void;
  info(message: string): void;
  debug(message: string): void;
}

/**
 * Stream-based log output implementation using process.stdout/stderr
 * This avoids direct console usage while maintaining equivalent functionality
 */
class StreamOutput implements LogOutput {
  warn(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  error(message: string, error?: string): void {
    const fullMessage = error !== undefined && error.length > 0
      ? `${message} ${error}\n`
      : `${message}\n`;
    process.stderr.write(fullMessage);
  }

  info(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  debug(message: string): void {
    process.stdout.write(`${message}\n`);
  }
}

/**
 * Logger class for controlled logging output
 */
export class Logger {
  private readonly context: string;
  private readonly enabled: boolean;
  private readonly output: LogOutput;

  constructor(context = 'Regrafter', enabled = true, output: LogOutput = new StreamOutput()) {
    this.context = context;
    this.enabled = enabled && process.env.NODE_ENV !== 'production';
    this.output = output;
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.enabled) {
      this.output.warn(`[${this.context}] ${message}`);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error): void {
    if (this.enabled) {
      this.output.error(`[${this.context}] ${message}`, error?.message ?? '');
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.enabled) {
      this.output.info(`[${this.context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    const debugEnv = process.env.DEBUG;
    if (this.enabled && debugEnv !== undefined && debugEnv.length > 0) {
      this.output.debug(`[${this.context}] ${message}`);
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context = 'Regrafter', enabled = true, output?: LogOutput): Logger {
  return new Logger(context, enabled, output);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
