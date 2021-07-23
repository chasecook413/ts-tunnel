"use strict";
exports.__esModule = true;
var WebSocket = require("ws");
var net = require("net");
var proxyServer = require("./proxy-server");
var WssClient = /** @class */ (function () {
    function WssClient(logger, serverPort, wsServerPort) {
        var _this = this;
        this.serverPort = serverPort;
        this.wsServerPort = wsServerPort;
        this.logger = logger;
        this.wsClient = new WebSocket("ws://localhost:" + this.wsServerPort);
        this.openSockets = new Map();
        var self = this;
        this.proxyServer = proxyServer.createProxy(this.logger, this.serverPort);
        this.wsClient.on('open', function () {
            // this.logger.info('Connection open');
        });
        this.wsClient.on('close', function () {
            // this.logger.info('Client disconnected');
        });
        this.wsClient.on('error', function (error) {
            _this.logger.error("Client: unexpected response: " + error);
        });
        this.wsClient.on('message', function (data) {
            var dataToWorkWith = _this.unpackData(data);
            // self.logger.info(`Client received message! ${util.inspect(dataToWorkWith)}`);
            if (dataToWorkWith.data === null) {
                // this.logger.info(dataToWorkWith);
                return;
            }
            if (self.proxyServer.listening) {
                // self.logger.info(`proxy server was listening`);
                var openSocket = null;
                openSocket = self.openSockets.get(dataToWorkWith.id);
                if (openSocket && !openSocket.destroyed) {
                    // self.logger.info(`Socket: ${util.inspect(openSocket)}`);
                    return openSocket.write(dataToWorkWith.data);
                }
                // this.logger.info(`Creating new socket for ID: ${dataToWorkWith.id}`);
                // const sock = net.createConnection({port: 9015, host: '127.0.0.1'}, () => {
                var sock_1 = net.createConnection({ port: self.serverPort, host: '127.0.0.1' }, function () {
                    self.openSockets.set(dataToWorkWith.id, sock_1);
                    // this.logger.info(`Opened socket, sending`);
                    sock_1.write(dataToWorkWith.data);
                });
                sock_1.on('data', function (proxyData) {
                    // this.logger.info(`Received data back!`);
                    var dataToSend = _this.packData({ id: dataToWorkWith.id, type: 'data' }, proxyData);
                    _this.wsClient.send(dataToSend);
                });
                sock_1.on('close', function () {
                    // self.logger.info(`Closed socket`);
                    var dataToSend = _this.packData({ id: dataToWorkWith.id, type: 'close' }, null);
                    _this.wsClient.send(dataToSend);
                    self.openSockets["delete"](dataToWorkWith.id);
                });
                sock_1.on('error', function (err) {
                    self.logger.error("Error on socket " + err.message);
                    var dataToSend = _this.packData({ id: dataToWorkWith.id, type: 'error' }, null);
                    _this.wsClient.send(dataToSend);
                    self.openSockets["delete"](dataToWorkWith.id);
                });
            }
        });
    }
    WssClient.prototype.packData = function (message, serverToClientData) {
        var binaryMessage = Buffer.from(JSON.stringify(message));
        var paddedLength = String(binaryMessage.byteLength).padStart(4, '0');
        var objectLength = Buffer.from(paddedLength);
        if (!serverToClientData) {
            return Buffer.concat([objectLength, binaryMessage]);
        }
        return Buffer.concat([objectLength, binaryMessage, serverToClientData]);
    };
    WssClient.prototype.unpackData = function (clientToServerData) {
        var lengthString = clientToServerData.slice(0, 4).toString();
        var length = parseInt(lengthString);
        var headerDataString = clientToServerData.slice(4, length + 4).toString();
        var headerData = JSON.parse(headerDataString);
        if (length + 4 === clientToServerData.byteLength) {
            headerData.data = null;
        }
        else {
            headerData.data = clientToServerData.slice(length + 4, clientToServerData.byteLength);
        }
        return headerData;
    };
    return WssClient;
}());
exports.WssClient = WssClient;
function createClient(logger, serverPort, wsServerPort) {
    return new WssClient(logger, serverPort, wsServerPort);
}
exports.createClient = createClient;
