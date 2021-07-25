import WebSocket = require('ws');
import {Server} from "ws";
import * as winston from 'winston';
import * as net from 'net';
import { v4 as uuid } from 'uuid';

export class WssServer {
    wsServer: Server | undefined;
    logger: winston.Logger;
    serverPort: number;
    wsServerPort: number;
    hasClientConnection: boolean;
    tcpListener: net.Server | undefined;
    tunnelClientWebSocket: WebSocket | undefined;
    openSockets: Map<string, net.Socket>;
    constructor(logger: winston.Logger, serverPort: number, wsServerPort: number) {
        this.serverPort = serverPort;
        this.wsServerPort = wsServerPort;
        this.logger = logger;
        this.hasClientConnection = false;
        this.openSockets = new Map<string, net.Socket>();
        this.startSocksServer().then(() => {
            this.startWebSocketServer();
        }).catch((error) => {
            this.logger.error(`Error starting socket server`);
            throw(error);
        });
    }

    onSocket(socket: net.Socket) {
        const self = this;
        if (!self.tunnelClientWebSocket) {
            // self.logger.info(`No client yet, rejecting data`);
            socket.destroy();
            return;
        }

        let id: string = uuid();
        this.openSockets.set(id, socket);
        socket.on('data', (data) => {
            // self.logger.info(`Received data on socket ${id}`);
            if (self.wsServer) {
                data = self.packData({id: id, type: 'data'}, data);
                if (self.tunnelClientWebSocket) {
                    self.tunnelClientWebSocket.send(data);
                }
            }
        });

        socket.on('error', (error) => {
            self.logger.error(`Error from socket: ${error.message}`);
            self.openSockets.delete(id);
        });

        socket.on('close', () => {
            // self.logger.info(`Socket closed`);
            self.openSockets.delete(id);
        });
    }

    startSocksServer() {
        return new Promise<void>((resolve, reject) => {
            const self = this;
            self.tcpListener = net.createServer((socket) => {
                self.onSocket(socket);
            });

            let ready = false;
            self.tcpListener.on('error', (error) => {
                self.logger.error(`Error occurred on tcp server: ${error.message}`);
            });

            self.tcpListener.listen(self.serverPort, () => {
                ready = true;
                resolve();
            });

            // if the server hasn't started in 10 seconds, reject
            setTimeout(() => {
                if (!ready) {
                    self.logger.error(`TCP Socket could not connect in 10 seconds`);
                    reject(new Error(`Unable to start tcplistener on port ${this.serverPort}`));
                }
            }, 10 * 1000);
        });
    }

    startWebSocketServer() {
        this.wsServer = new WebSocket.Server({port: this.wsServerPort});
        // this.logger.info(`Server listening on port ${this.port}`);

        const self = this;
        this.wsServer.on('connection', (ws, req) => {
            if (self.hasClientConnection) {
                self.logger.info(`New Connection from ${ws.url}, destroying`);
                if (self.tunnelClientWebSocket) {
                    return self.tunnelClientWebSocket.close();
                }
            }

            self.tunnelClientWebSocket = ws;
            self.hasClientConnection = true;
            self.tunnelClientWebSocket.on('message', (message: Uint8Array) => {
                const parsedMessage: any = self.unpackData(message);
                let socket = null;
                if (!parsedMessage.id) {
                    return;
                }

                socket = self.openSockets.get(parsedMessage.id);
                if (!socket) {
                    let dataToSend = this.packData({id: parsedMessage.id, type: 'close'}, null);
                    if (self.tunnelClientWebSocket) {
                        return self.tunnelClientWebSocket.send(dataToSend);
                    }
                }

                switch (parsedMessage.type) {
                    case 'data':
                        // @ts-ignore
                        if (!socket.destroyed) {
                            // @ts-ignore
                            socket.write(parsedMessage.data);
                        }
                        break;
                    case 'close':
                        if (parsedMessage.data) {
                            // @ts-ignore
                            if (!socket.destroyed) {
                                // @ts-ignore
                                socket.end(parsedMessage.data);
                            }
                        } else {
                            // @ts-ignore
                            if (!socket.destroyed) {
                                // @ts-ignore
                                socket.end();
                            }
                        }
                        break;
                    case 'error':
                        this.logger.info(`Error for ${parsedMessage.id}`);
                        // @ts-ignore
                        if (!socket.destroyed) {
                            // @ts-ignore
                            socket.end();
                        }
                        break;
                }
            });
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
        const lengthString = clientToServerData.slice(0,4).toString();
        const length: number = parseInt(lengthString);
        const headerDataString: string = clientToServerData.slice(4, length + 4).toString();
        const headerData: any = JSON.parse(headerDataString);
        if (length + 4 === clientToServerData.byteLength) {
            headerData.data = null;
        } else {
            headerData.data = clientToServerData.slice(length + 4, clientToServerData.byteLength);
            // headerData.data = Buffer.from(clientToServerData.buffer, length + 4, clientToServerData.byteLength - 1);
        }
        return headerData;
    }
}

export function createServer(logger: winston.Logger, serverPort: number, wsServerPort: number) {
    return new WssServer(logger, serverPort, wsServerPort);
}
