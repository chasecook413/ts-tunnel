import * as winston from 'winston';
import * as wsServer from "./ws-server";

const logger: winston.Logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ level: 'debug', format: winston.format.simple() }),
    ],
});

const server: wsServer.WssServer = wsServer.createServer(logger, 4701, 4700);
