"use strict";
exports.__esModule = true;
var winston = require("winston");
var wsServer = require("./ws-server");
var logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ level: 'debug', format: winston.format.simple() }),
    ]
});
var server = wsServer.createServer(logger, 4701, 4700);
