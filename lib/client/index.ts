import * as winston from 'winston';
import * as wsClient from "./ws-client";

const logger: winston.Logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ level: 'debug', format: winston.format.simple() }),
    ],
});

process.on('uncaughtException', (err) => {
    logger.error(`Error thrown: ${err.stack}`);
    process.exit(1);
});

const client: wsClient.WssClient = wsClient.createClient(logger, 8080, 4700);
