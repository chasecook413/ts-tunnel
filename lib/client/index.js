"use strict";
exports.__esModule = true;
var winston = require("winston");
var wsClient = require("./ws-client");
var logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ level: 'debug', format: winston.format.simple() }),
    ]
});
process.on('uncaughtException', function (err) {
    logger.error("Error thrown: " + err.stack);
    process.exit(1);
});
var client = wsClient.createClient(logger, 8080, 4700);
