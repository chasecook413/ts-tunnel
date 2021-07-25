import * as util from 'util';
import WebSocket = require('ws');
import * as winston from 'winston';
import * as http from 'http';
import * as net from 'net';
import * as proxyServer from './proxy-server';

export class WssClient {
    wsClient: WebSocket;
    logger: winston.Logger;
    serverPort: number;
    wsServerPort: number;
    proxyServer: proxyServer.ProxyServer;
    openSockets: Map<string, net.Socket>;

    constructor(logger: winston.Logger, serverPort: number, wsServerPort: number) {
        this.serverPort = serverPort;
        this.wsServerPort = wsServerPort;
        this.logger = logger;
        this.wsClient = new WebSocket(`ws://localhost:${this.wsServerPort}`);
        this.openSockets = new Map<string, net.Socket>();
        const self = this;

        this.proxyServer = proxyServer.createProxy(this.logger, this.serverPort);
        this.wsClient.on('open', () => {
            // this.logger.info('Connection open');
        });

        this.wsClient.on('close', () => {
            // this.logger.info('Client disconnected');
        });

        this.wsClient.on('error', (error) => {
            this.logger.error(`Client: unexpected response: ${error}`);
        });

        this.wsClient.on('message', (data: Uint8Array) => {
            const dataToWorkWith = this.unpackData(data);
            // self.logger.info(`Client received message! ${util.inspect(dataToWorkWith)}`);
            if (dataToWorkWith.data === null) {
                // this.logger.info(dataToWorkWith);
                return;
            }

            if (self.proxyServer.listening()) {
                // self.logger.info(`proxy server was listening`);
                let openSocket = null;

                openSocket = self.openSockets.get(dataToWorkWith.id);
                if (openSocket && !openSocket.destroyed) {
                    // self.logger.info(`Socket: ${util.inspect(openSocket)}`);
                    return openSocket.write(dataToWorkWith.data);
                }

                // this.logger.info(`Creating new socket for ID: ${dataToWorkWith.id}`);
                // const sock = net.createConnection({port: 9015, host: '127.0.0.1'}, () => {
                const sock = net.createConnection({port: self.serverPort, host: '127.0.0.1'}, () => {
                    self.openSockets.set(dataToWorkWith.id, sock);
                    // this.logger.info(`Opened socket, sending`);
                    sock.write(dataToWorkWith.data);
                });

                sock.on('data', (proxyData) => {
                    // this.logger.info(`Received data back!`);
                    let dataToSend = this.packData({id: dataToWorkWith.id, type: 'data'}, proxyData);
                    this.wsClient.send(dataToSend);
                });

                sock.on('close', () => {
                    // self.logger.info(`Closed socket`);
                    let dataToSend = this.packData({id: dataToWorkWith.id, type: 'close'}, null);
                    this.wsClient.send(dataToSend);
                    self.openSockets.delete(dataToWorkWith.id);
                });

                sock.on('error', (err) => {
                    self.logger.error(`Error on socket ${err.message}`);
                    let dataToSend = this.packData({id: dataToWorkWith.id, type: 'error'}, null);
                    this.wsClient.send(dataToSend);
                    self.openSockets.delete(dataToWorkWith.id);
                });
            }
        });
    }

    packData(message: Object, serverToClientData: Uint8Array | null) {
        const binaryMessage = Buffer.from(JSON.stringify(message));
        const paddedLength = String(binaryMessage.byteLength).padStart(4, '0');
        const objectLength = Buffer.from(paddedLength);
        if (!serverToClientData) {
            return Buffer.concat([objectLength, binaryMessage]);
        }
        return Buffer.concat([objectLength, binaryMessage, serverToClientData]);
    }

    unpackData(clientToServerData: Uint8Array) {
        const lengthString = clientToServerData.slice(0, 4).toString();
        const length: number = parseInt(lengthString);
        const headerDataString: string = clientToServerData.slice(4, length + 4).toString()
        const headerData: any = JSON.parse(headerDataString);
        if (length + 4 === clientToServerData.byteLength) {
            headerData.data = null;
        } else {
            headerData.data = clientToServerData.slice(length + 4, clientToServerData.byteLength);
        }
        return headerData;
    }
}

export function createClient(logger: winston.Logger, serverPort: number, wsServerPort: number) {
    return new WssClient(logger, serverPort, wsServerPort);
}
