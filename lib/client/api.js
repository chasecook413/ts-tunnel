"use strict";
exports.__esModule = true;
var API = /** @class */ (function () {
    function API(logger, proxyServer) {
        this.logger = logger;
        this.proxyServer = proxyServer;
        this.routes = new Map();
        var self = this;
        self.logger.info("API init");
        this.routes.set('/admin', this.adminResponse);
    }
    API.prototype.handleRequest = function (req, res) {
        this.logger.info("New request to " + req.url);
        var fn = this.routes.get(req.url);
        if (fn) {
            return fn(req, res);
        }
        else {
            return this.fourOFour(req, res);
        }
    };
    API.prototype.adminResponse = function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.write(JSON.stringify({
            message: 'admin-api'
        }));
        res.end(null);
    };
    API.prototype.fourOFour = function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 404;
        res.write(JSON.stringify({
            'message': 'invalid route'
        }));
        return res.end(null);
    };
    return API;
}());
exports.API = API;
function createApi(logger, proxyServer) {
    return new API(logger, proxyServer);
}
exports.createApi = createApi;
