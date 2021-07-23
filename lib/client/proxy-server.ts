import * as http from 'http';
import * as winston from 'winston';
import * as httpProxy from 'http-proxy';
import * as net from 'net';
import * as api from './api';

export class ProxyServer {
    server: http.Server;
    logger: winston.Logger;
    api: api.API;

    constructor(logger: winston.Logger, port: number) {
        this.logger = logger;
        this.api = api.createApi(this.logger, this);
        const self = this;

        const proxy = new httpProxy.createProxyServer({
            ws: true,
            secure: true,
        });

        proxy.on('error', (proxyError: Error) => {
            this.logger.error(`Proxy Error: ${proxyError.stack}`);
        });

        this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
            // self.logger.info(`Incoming request for ${req.url}`);
            let url;

            if (/^\/admin*/.test(req.url)) {
                self.logger.info(`Request came in for admin server`);
                return this.api.handleRequest(req, res);
            }

            try {
                url = new URL(req.url);
            } catch (urlException) {
                self.logger.error(`Error retrieving URL for request`);
                res.write(JSON.stringify({
                    message: `Error resolving`,
                }));

                return res.end(null);
            }

            const protocol = url.protocol;
            const host = url.host;
            const port = parseInt(url.port) || 80;
            const target = `${protocol}//${host}:${port}`;

            proxy.web(req, res, { target });
        });

        this.server.on('upgrade', (req, socket, head) => {
            self.logger.info(`Received upgrade request to ${req.url}, we must be talking ws`);
            proxy.ws(req, socket, head);
        });

        this.server.on('connect', (req, clientSocket, head) => {
            let hostPort = this.parseConnectString(req.url, 443);
            // this.logger.info(`Parsed host and port: ${hostPort.host} and ${hostPort.port}`);

            const proxySocket = new net.Socket();
            proxySocket.connect(hostPort.port, hostPort.host, () => {
                proxySocket.write(head);
                if (clientSocket) {
                    return clientSocket.write(self.getConnectionEstablished(req.httpVersion));
                }
            });

            proxySocket.on('data', (data) => {
                if (!clientSocket.destroyed) {
                    clientSocket.write(data);
                }
            });

            proxySocket.on('end', function() {
                // self.logger.info(`Got end on proxySocket`);
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });

            proxySocket.on('error', (err) => {
                self.logger.error(`Error on proxy socket: ${err.message}`);
            });

            clientSocket.on('data', (data) => {
                // self.logger.info(`Got more client data`);
                if (!proxySocket.destroyed) {
                    proxySocket.write(data);
                }
            });

            clientSocket.on('end', () => {
                // self.logger.info(`clientSocket ended`);
                if (!proxySocket.destroyed) {
                    proxySocket.end();
                }
            });

            clientSocket.on('error', (err) => {
                self.logger.info(`Error on proxy socket: ${err.message}`);
            });
        });

        this.server.on('error', (err) => {
            self.logger.error(`Error on proxy server: ${err.message}`);
        });

        this.server.listen(port, '127.0.0.1');
    }

    parseConnectString(connectString, defaultPort) {
        let host = connectString;
        let port = defaultPort;

        const result = /^([^:]+)(:([0-9]+))?$/.exec(connectString);
        if (result != null) {
            host = result[1];
            if (result[2] != null) {
                port = result[3];
            }
        }

        return { host, port };
    }

    getConnectionEstablished(httpVersion) {
        return "HTTP/" + httpVersion + " 200 Connection established\r\n\r\n";
    }

    listening() {
        return this.server.listening;
    }
}

export function createProxy(logger: winston.Logger, port: number) {
    return new ProxyServer(logger, port);
}
