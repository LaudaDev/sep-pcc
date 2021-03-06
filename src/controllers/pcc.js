// SEP-PCC MAIN CONTROLLERS

'use strict'

const models = require('../models');
const request = require('request');
const boom = require('boom');
const Issuer = models.Issuer;
const Log = models.TransactionLog;

module.exports = {
	issuerLog:function(request, reply) {
		Log.findAll({
			where: {
				issuerId: request.params.id
			}
		}).then(function(data) {
			return reply(data);
		});
	},

	auth:function(req, reply) {
		// Get JSON request
		var reqJson = (req.headers['content-type'].indexOf('json') === -1) ? JSON.parse(req.payload) : req.payload;

		// Issuer ID (first 6 chars from PAN)
		var issuerId = reqJson.cardInfo.pan.slice(0, 6);

		// Query the DB to find issuer by his ID
		Issuer.findAll({
			where: {
				pan: issuerId
			}
		}).then((data) => {
			// Send a request to Issuer
			request({
				url: data[0]['dataValues'].url,
				method: "POST",
				json: reqJson
			},
			// Process the response from Issuer
			function (error, response, data) {
				// Check if issuer sent any response
				if (typeof response === 'undefined') {
					return reply(JSON.parse('{"transactionStatus":{"code": "05", "message": "SERVER_ERROR"}}'));
				}
				// Only JSON is accepted
				if (response.headers['content-type'].indexOf('json') === -1) {
					return reply(JSON.parse('{"transactionStatus":{"code": "04", "message": "REQUEST_FORMAT_ERROR"}}'));
				}
				if (!error && response.statusCode === 200) {
						// Log transaction data between Acquirer and Issuer in case of errors or lost data between Acquirer & Issuer.
						Log.create({
							acquirerOrderId: reqJson.acquirerInfo.orderId,
							acquirerTimestamp: reqJson.acquirerInfo.timestamp,
							transactionAmount: reqJson.transactionAmount,
							issuerId: issuerId,
							issuerOrderId: (data.transactionStatus.code === '00') ? data.issuerInfo.orderId : -1,
							issuerTimestamp: (data.transactionStatus.code === '00') ? data.issuerInfo.timestamp : -1,
							statusCode: data.transactionStatus.code,
							statusMessage: data.transactionStatus.message
						}).then((log) => {
							console.log("Transaction log data inserted with ID = " + log.get('id'));
						});

						// Return response to acquirer server with JSON dana sent from Issuer
						return reply(data);
				}
				else {
					// In case Issuer's statusCode return other than 200, return error message to acquirer.
					return reply(JSON.parse('{"transactionStatus":{"code": "05", "message": "SERVER_ERROR"}}'));
				}
			});
		})
	}
};
