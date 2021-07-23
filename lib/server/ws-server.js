"use strict";
exports.__esModule = true;
var WebSocket = require("ws");
var net = require("net");
var uuid_1 = require("uuid");
var WssServer = /** @class */ (function () {
    function WssServer(logger, serverPort, wsServerPort) {
        var _this = this;
        this.serverPort = serverPort;
        this.wsServerPort = wsServerPort;
        this.logger = logger;
        this.hasClientConnection = false;
        this.openSockets = new Map();
        this.startSocksServer().then(function () {
            _this.startWebSocketServer();
        })["catch"](function (error) {
            _this.logger.error("Error starting socket server");
            throw (error);
        });
    }
    WssServer.prototype.onSocket = function (socket) {
        var self = this;
        if (!self.tunnelClientWebSocket) {
            // self.logger.info(`No client yet, rejecting data`);
            socket.destroy(null);
            return;
        }
        var id = uuid_1.v4();
        this.openSockets.set(id, socket);
        socket.on('data', function (data) {
            // self.logger.info(`Received data on socket ${id}`);
            if (self.wsServer) {
                data = self.packData({ id: id, type: 'data' }, data);
                self.tunnelClientWebSocket.send(data);
            }
        });
        socket.on('error', function (error) {
            self.logger.error("Error from socket: " + error.message);
            self.openSockets["delete"](id);
        });
        socket.on('close', function () {
            // self.logger.info(`Socket closed`);
            self.openSockets["delete"](id);
        });
    };
    WssServer.prototype.startSocksServer = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var self = _this;
            self.tcpListener = net.createServer(function (socket) {
                self.onSocket(socket);
            });
            var ready = false;
            self.tcpListener.on('error', function (error) {
                self.logger.error("Error occurred on tcp server: " + error.message);
            });
            self.tcpListener.listen(self.serverPort, function () {
                ready = true;
                resolve();
            });
            // if the server hasn't started in 10 seconds, reject
            setTimeout(function () {
                if (!ready) {
                    self.logger.error("TCP Socket could not connect in 10 seconds");
                    reject(new Error("Unable to start tcplistener on port " + _this.serverPort));
                }
            }, 10 * 1000);
        });
    };
    WssServer.prototype.startWebSocketServer = function () {
        var _this = this;
        this.wsServer = new WebSocket.Server({ port: this.wsServerPort });
        // this.logger.info(`Server listening on port ${this.port}`);
        var self = this;
        this.wsServer.on('connection', function (ws, req) {
            if (self.hasClientConnection) {
                self.logger.info("New Connection from " + ws.url + ", destroying");
                return self.tunnelClientWebSocket.close();
            }
            self.tunnelClientWebSocket = ws;
            self.hasClientConnection = true;
            self.tunnelClientWebSocket.on('message', function (message) {
                var parsedMessage = self.unpackData(message);
                var socket = null;
                if (!parsedMessage.id) {
                    return;
                }
                socket = self.openSockets.get(parsedMessage.id);
                if (!socket) {
                    var dataToSend = _this.packData({ id: parsedMessage.id, type: 'close' }, null);
                    return self.tunnelClientWebSocket.send(dataToSend);
                }
                switch (parsedMessage.type) {
                    case 'data':
                        if (!socket.destroyed) {
                            socket.write(parsedMessage.data);
                        }
                        break;
                    case 'close':
                        if (parsedMessage.data) {
                            if (!socket.destroyed) {
                                socket.end(parsedMessage.data);
                            }
                        }
                        else {
                            if (!socket.destroyed) {
                                socket.end();
                            }
                        }
                        break;
                    case 'error':
                        _this.logger.info("Error for " + parsedMessage.id);
                        if (!socket.destroyed) {
                            socket.end();
                        }
                        break;
                }
            });
        });
    };
    WssServer.prototype.packData = function (message, serverToClientData) {
        var binaryMessage = Buffer.from(JSON.stringify(message));
        var paddedLength = String(binaryMessage.byteLength).padStart(4, '0');
        var objectLength = Buffer.from(paddedLength);
        if (!serverToClientData) {
            return Buffer.concat([objectLength, binaryMessage]);
        }
        return Buffer.concat([objectLength, binaryMessage, serverToClientData]);
    };
    WssServer.prototype.unpackData = function (clientToServerData) {
        var lengthString = clientToServerData.slice(0, 4).toString();
        var length = parseInt(lengthString);
        var headerDataString = clientToServerData.slice(4, length + 4).toString();
        var headerData = JSON.parse(headerDataString);
        if (length + 4 === clientToServerData.byteLength) {
            headerData.data = null;
        }
        else {
            headerData.data = clientToServerData.slice(length + 4, clientToServerData.byteLength);
            // headerData.data = Buffer.from(clientToServerData.buffer, length + 4, clientToServerData.byteLength - 1);
        }
        return headerData;
    };
    return WssServer;
}());
exports.WssServer = WssServer;
function createServer(logger, serverPort, wsServerPort) {
    return new WssServer(logger, serverPort, wsServerPort);
}
exports.createServer = createServer;
