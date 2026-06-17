import winston from 'winston';
import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            const base = `${timestamp} [${level}]: ${message}`;
            return stack ? `${base}\n${stack}` : base;
          })
        )
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
