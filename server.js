// SEP PCC 2015
'use strict';

var Hapi = require('hapi');
var path = require('path');
const fs = require('fs');
var config = require('./src/config/config.json');
var routes = require('./src/routes/routes.js');
var plugins = require('./src/plugins/plugins.js');
const server = new Hapi.Server({ load: { sampleInterval: 1000 } });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Disable if you want to reject unauthorized certs.

server.connection({
	host: config.server.hostname,
	port: config.server.https_port,
	tls: {
		key: fs.readFileSync(path.join(__dirname, config.https.key), 'utf8'),
		cert: fs.readFileSync(path.join(__dirname, config.https.cert), 'utf8'),
		rejectUnauthorized: false
	},
	labels: 'https'
});

server.connection({
	host: config.server.hostname,
	port: config.server.port,
	labels: 'http'
});

// Main setup
var setup = function() {
	// Register all plugins
	server.register(plugins, function (err) {
		if (err) {
			throw err; // Something bad happened while loading plugins
		}
	});

	// Add the server routes
	server.route(routes);

	// Redirect all http requests to https connection (not the very best solution due to possible MITM attack, recheck this)
	server.select('http').route({
		method: '*',
		path: '/{p*}',
		handler: function(request, reply) {
			return reply().redirect('https://' + config.server.hostname + ":" + config.server.https_port + request.url.path).permanent();
		}
	});

	// Show server info on default route
	server.route({
		method: 'GET',
		path: '/',
		handler: function(request, reply) {
			let uptime = Math.floor(Date.now()) - server.select('https').info.started;
			reply(JSON.parse('{"status":"online","uptime":"'+uptime+'","load":"'+server.load.heapUsed+'","version":"'+server.version+'"}'))
		}
	});
};

// Start the server
server.start((err) => {
	if (err) {
		throw err;
	}
	setup(); // Run setup
	console.log('Servers running at:', server.select('http').info.uri + " and " + server.select('https').info.uri);
});
