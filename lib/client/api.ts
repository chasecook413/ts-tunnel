import * as winston from 'winston';
import * as proxyServer from './proxy-server';
import * as http from 'http';

export class API {
    logger: winston.Logger;
    proxyServer: proxyServer.ProxyServer;
    routes: Map<string, Function>;

    constructor(logger: winston.Logger, proxyServer: proxyServer.ProxyServer) {
        this.logger = logger;
        this.proxyServer = proxyServer;
        this.routes = new Map<string, Function>();
        const self = this;
        self.logger.info(`API init`);

        this.routes.set('/admin', this.adminResponse);
    }

    handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        this.logger.info(`New request to ${req.url}`);
        const fn = this.routes.get(<string>req.url);
        if (fn) {
            return fn(req, res);
        } else {
            return this.fourOFour(req, res);
        }
    }

    adminResponse(req: http.IncomingMessage, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.write(JSON.stringify({
            message: 'admin-api',
        }));

        res.end(null);
    }

    fourOFour(req: http.IncomingMessage, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 404;
        res.write(JSON.stringify({
            'message': 'invalid route',
        }));

        return res.end(null);
    }
}

export function createApi(logger: winston.Logger, proxyServer: proxyServer.ProxyServer) {
    return new API(logger, proxyServer);
}
