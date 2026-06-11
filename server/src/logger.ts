import winston from 'winston';

// Structured JSON logger: one JSON object per line on stdout, ready to be
// ingested by the ELK stack (Logstash / Filebeat read the container's stdout).
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'orion-crm-server' },
  transports: [new winston.transports.Console()],
});
