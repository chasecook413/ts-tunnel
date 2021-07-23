"use strict";
exports.__esModule = true;
var http = require("http");
var httpProxy = require("http-proxy");
var net = require("net");
var api = require("./api");
var ProxyServer = /** @class */ (function () {
    function ProxyServer(logger, port) {
        var _this = this;
        this.logger = logger;
        this.api = api.createApi(this.logger, this);
        var self = this;
        var proxy = new httpProxy.createProxyServer({
            ws: true,
            secure: true
        });
        proxy.on('error', function (proxyError) {
            _this.logger.error("Proxy Error: " + proxyError.stack);
        });
        this.server = http.createServer(function (req, res) {
            // self.logger.info(`Incoming request for ${req.url}`);
            var url;
            if (/^\/admin*/.test(req.url)) {
                self.logger.info("Request came in for admin server");
                return _this.api.handleRequest(req, res);
            }
            try {
                url = new URL(req.url);
            }
            catch (urlException) {
                self.logger.error("Error retrieving URL for request");
                res.write(JSON.stringify({
                    message: "Error resolving"
                }));
                return res.end(null);
            }
            var protocol = url.protocol;
            var host = url.host;
            var port = parseInt(url.port) || 80;
            var target = protocol + "//" + host + ":" + port;
            proxy.web(req, res, { target: target });
        });
        this.server.on('upgrade', function (req, socket, head) {
            self.logger.info("Received upgrade request to " + req.url + ", we must be talking ws");
            proxy.ws(req, socket, head);
        });
        this.server.on('connect', function (req, clientSocket, head) {
            var hostPort = _this.parseConnectString(req.url, 443);
            // this.logger.info(`Parsed host and port: ${hostPort.host} and ${hostPort.port}`);
            var proxySocket = new net.Socket();
            proxySocket.connect(hostPort.port, hostPort.host, function () {
                proxySocket.write(head);
                if (clientSocket) {
                    return clientSocket.write(self.getConnectionEstablished(req.httpVersion));
                }
            });
            proxySocket.on('data', function (data) {
                if (!clientSocket.destroyed) {
                    clientSocket.write(data);
                }
            });
            proxySocket.on('end', function () {
                // self.logger.info(`Got end on proxySocket`);
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });
            proxySocket.on('error', function (err) {
                self.logger.error("Error on proxy socket: " + err.message);
            });
            clientSocket.on('data', function (data) {
                // self.logger.info(`Got more client data`);
                if (!proxySocket.destroyed) {
                    proxySocket.write(data);
                }
            });
            clientSocket.on('end', function () {
                // self.logger.info(`clientSocket ended`);
                if (!proxySocket.destroyed) {
                    proxySocket.end();
                }
            });
            clientSocket.on('error', function (err) {
                self.logger.info("Error on proxy socket: " + err.message);
            });
        });
        this.server.on('error', function (err) {
            self.logger.error("Error on proxy server: " + err.message);
        });
        this.server.listen(port, '127.0.0.1');
    }
    ProxyServer.prototype.parseConnectString = function (connectString, defaultPort) {
        var host = connectString;
        var port = defaultPort;
        var result = /^([^:]+)(:([0-9]+))?$/.exec(connectString);
        if (result != null) {
            host = result[1];
            if (result[2] != null) {
                port = result[3];
            }
        }
        return { host: host, port: port };
    };
    ProxyServer.prototype.getConnectionEstablished = function (httpVersion) {
        return "HTTP/" + httpVersion + " 200 Connection established\r\n\r\n";
    };
    ProxyServer.prototype.listening = function () {
        return this.server.listening;
    };
    return ProxyServer;
}());
exports.ProxyServer = ProxyServer;
function createProxy(logger, port) {
    return new ProxyServer(logger, port);
}
exports.createProxy = createProxy;
