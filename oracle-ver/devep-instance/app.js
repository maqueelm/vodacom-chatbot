/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var uuid = require('uuid');
var sync = require('synchronize');
var Regex = require('regex');
var express = require('express'); // app server
var session = require('express-session');
var S = require('string');
var dbConfig = require('./db/dbconfig.js');
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
var striptags = require('striptags');
/* Variables Declaration */
var app = express();
var connection = null;
var inputText = null;
var outputText = null;
var conversationId = null;
var all_output = null;
var lastUsedIntent = null;
var lastUsedEntity = null;
var userFullName = null;
var lastOutputText = null;
var lastResponse = null;
var oracleConnectionString = {
	user: dbConfig.user,
	password: dbConfig.password,
	connectString: dbConfig.connectString
};

var fiber = sync.fiber;
var await = sync.await;
var defer = sync.defer;

app.use('/', express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(session({
	secret: 'vodacom-chatbot-ZCAAMVI',
	resave: false,
	saveUninitialized: true,
	cookie: {}
}))

require('./utility/intenthandler.js')();
require('./utility/orchestration.js')();
require('./db/db-oracle.js')();
require('./db/db-mysql.js')();
require('./utility/stringhandler.js')();
require('./utility/contexthandler.js')();
require('./utility/watsonentityhandler')();

// Create the service wrapper
var conversation = new Conversation({
	// If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
	// After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
	username: process.env.CONVERSATION_USERNAME,
	password: process.env.CONVERSATION_PASSWORD,
	url: 'https://gateway.watsonplatform.net/conversation/api',
	version_date: '2016-10-21',
	version: 'v1'
});

var discovery = new DiscoveryV1({ username: process.env.DISCOVERY_SERVICE_USERNAME, password: process.env.DISCOVERY_SERVICE_PASSWORD, version_date: process.env.DISCOVERY_SERVICE_VERSION_DATE })

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	if (!workspace || workspace === '<workspace-id>') {
		return res.json({
			'output': {
				'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
			}
		});
	}
	var payload = {
		workspace_id: workspace,
		context: req.body.context || {},
		input: req.body.input || {}
	};


	if (req.body.input != null) {
		inputText = req.body.input.text;
		//console.log("Input provided is => "+req.body.input.text);
	}
	var hour = 3600000; // in milisecond   60000 (one minute) , session time set to 1 hour for now.
	req.session.cookie.expires = new Date(Date.now() + hour)
	req.session.cookie.maxAge = hour

	if (!req.session.response) {
		req.session.response = {}
	}

	try {

		fiber(function () {

			response = getResponse(payload,sync);
			if (response.context.conversation_id != null) {
				conversationId = response.context.conversation_id;
			}



			console.log("Response JSON =>" + JSON.stringify(response));

			if (response != null && response.context != null && response.context.cxt_user_logged_in) {

				console.log("user is logged in now checking intent");

				/* SITES intent and context variable code */
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleSitesIntent(response, inputText, response.output.text, sync);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;

				/*Incident Intent Handling.*/
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleIncidentIntent(response, inputText, sync);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;

				/*Corporate Customer Intent handling.*/
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleCustomerIntent(response, inputText, response.output.text, sync);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;

				/*Region Intent Handling.*/
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleRegionIntent(response, inputText, response.output.text, sync);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;

				/*transmission failure Intent handling.*/
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleTransmissionFailureIntent(response, inputText, response.output.text, sync);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;

				/*Escalation Intent Handling.*/
				if (response != null && response.intents != null && response.intents.length != 0)
					var data = handleEscalationIntent(response, inputText, response.output.text, await, defer, discovery);
				if (data != null && data.output != null) {
					response.output.text = data.output.text;
				}
				response = data;


				if (response != null && response.output != null && response.output.text != null && response.output.text[0] != null) {

					if (response.context != null && response.context.cxt_show_location_list_tech_type && response.context.cxt_location_list_trx_failure_query != null && response.context.cxt_location_name_trx_flow == null) {
						response.output.text[0] = updateSuggestedLocationsInMessage(response.output.text[0], response.context.cxt_location_list_trx_failure_query, sync);
					}

				}
				if (response != null && response.context != null && response.context.cxt_region_flow_search_for_location && response.context.cxt_location_list_region_fault_flow_query != null) {
					console.log("replace isolated_fault_location_list");
					//[isolated_fault_location_list_here]
					response.output.text[0] = updateSuggestedLocationsInMessage(response.output.text[0], response.context.cxt_location_list_region_fault_flow_query, sync);
				}
			}

			//console.log(JSON.stringify(response));
			if (response != null && response.context != null) {
				response = startOverConversationWithContext(response, sync);

				response = showChildIncidentsWithContext(response, sync, conversationId);

				response = showParentIncidentDetailsWithContext(response, sync);

				response = showMasterIncidentForRegionWithContext(response, sync, conversationId);

				response = regionIntentIsolatedFaultFlowWithContext(response, sync, conversationId);

				response = technologyTypeFlowWithContext(response, sync, conversationId);

				response = corporateCustomerFlowWithContext(response, sync);
			} else {
				console.log("Context is null");
			}

			if (req.session.response.context == null) {
				response = userLoginWithContext(response, sync);
			}


			if (response != null && response.context != null && response.context.cxt_user_logged_in) {
				req.session.response = response;
			}

			if (response != null && response.context != null && !response.context.cxt_user_logged_in && req.session.response.context != null) {
				console.log("restoring user details from session");


				response = req.session.response;
			}

			//console.log("req.session.response=>"+JSON.stringify(response));
			return res.json(updateMessage(payload, response));

		});  // fiber ends here


	} catch (err) {
		//TODO Handle error
		console.log("error=>" + JSON.stringify(err.stack));
	}
});



var http = require('http'),
	url = require('url'),
	fs = require('fs');

app.get('/download', function (req, res) {
	var query = url.parse(req.url, true).query;
	res.download("./" + query.file);
})

app.get('/feedbackOptions', function (req, res) {

	var query = url.parse(req.url, true).query;
	//console.log(query.reason);
	var feedbackReason = query.reason;
	var feedbackReasonText = query.reasonText;
	if (feedbackReason && response) {
		//console.log(all_output);
		var feedback_value = -1; // -1 is for thumbs down
		recordFeedback(response, feedbackReason, feedback_value, feedbackReasonText, 0);
	}
})

// /feedback/?feedback=1
app.get('/feedback', function (req, res) {
	var query = url.parse(req.url, true).query;
	var feedback_value = query.feedbackVal;
	var save_data = false;
	if (parseInt(feedback_value)) {
		save_data = true;
	} else {
		save_data = false;
	}
	//console.log(save_data + "=" + parseInt(feedback_value));

	if (save_data && all_output) {
		recordFeedback(all_output, null, feedback_value, null, 0);
	}
})

app.get('/rating', function (req, res) {
	var query = url.parse(req.url, true).query;
	var ratingValue = query.ratingVal;

	if (ratingValue > 0) {
		console.log("ratingValue =>" + JSON.stringify(ratingValue));
		var recordInserted = recordFeedback(all_output, null, 1, null, ratingValue);
		if (recordInserted) {
			res.send('1');
		}

	}

	/*if (save_data && all_output) {
		recordFeedback(all_output, null, feedback_value);
	}*/
})

/**
 * Description
 * @method recordFeedback
 * @param {} response
 * @param {} feedbackReason
 * @param {} feedback_value
 * @param {} feedbackReasonText
 * @param {} ratingValue
 * @return 
 */
function recordFeedback(response, feedbackReason, feedback_value, feedbackReasonText, ratingValue) {
	//console.log("recordFeedback=>feedbackReason =>" + JSON.stringify(feedbackReason));
	var conversationId = lastResponse.context.conversation_id;
	// fetch the last inserted record by the user based on its conversation Id
	var getFeedBackIdSql = "SELECT feedback_id FROM `feedback` where conversationId = '" + conversationId + "' ORDER BY `feedback_id` DESC limit 1";
	var feedbackoutput = executeQuerySync(getFeedBackIdSql);
	var feedbackId = -1;
	if (feedbackoutput != null && feedbackoutput.data != null && feedbackoutput.data.rows != null && feedbackoutput.data.rows.length > 0) {

		feedbackId = feedbackoutput.data.rows[0].feedback_id;

	}

	var feedback_sql = '';
	if (ratingValue > 0) {
		console.log("Insert feedback with rating =>" + JSON.stringify(ratingValue));
		feedback_sql = "UPDATE feedback SET feedback = " + feedback_value + ",rating_value=" + ratingValue + " where feedback_id =" + feedbackId;
	} else {
		feedback_sql = "UPDATE feedback SET feedback = " + feedback_value + ",feedback_comment=" + feedbackReason + ",feedback_comment_other = '" + feedbackReasonText + "' where feedback_id=" + feedbackId;
	}
	console.log("query update feedback =>" + feedback_sql);
	var output = executeQuerySync(feedback_sql);
	//console.log("output =>" + JSON.stringify(output));
	if (output.success) {
		console.log("Feedback Inserted into database");
		return true;
	} else {
		return false;
	}

}

/**
 * Description
 * @method recordResponseTime
 * @param {} response
 * @return 
 */
function recordResponseTime(response) {
	console.log("recordResponseTime");
	var intent = null;
	var entity = null;
	var intentConfidence = null;
	var entityConfidence = null;
	var conversationId = null;
	var fullName = null;
	if (response != null) {
		//console.log(response);
		if (response.intents[0] != null) {
			intent = response.intents[0].intent;
			intentConfidence = response.intents[0].confidence;
			//lastUsedIntent = intent;
		}
		if (response.entities[0] != null) {
			entity = response.entities[0].entity;
			entityConfidence = response.entities[0].confidence;
			//lastUsedEntity = entity;
			//putting entity in place of intent as mostly entities are of importance and tell the flow of dialog.
			intent = entity;
		}
		var outputText = '';
		//console.log(outputText);
		if (response.output.text != null) {
			for (i = 0; i < response.output.text.length; i++) {
				outputText += response.output.text[i] + "<br/>";
			}
			outputText = striptags(outputText);
			outputText = S(outputText).replaceAll('?file', 'file').s;
			outputText = S(outputText).replaceAll("openExcelDownloadWindow('", "openExcelDownloadWindow").s;
			outputText = S(outputText).replaceAll("')>Download", "Download").s;
			conversationId = response.context.conversation_id;
			fullName = response.context.cxt_user_full_name;
			if (intent != null && entity != null && inputText != null) {
				var feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, username,conversationId,intent_confidence,entity_confidence) VALUES ('" + inputText + "', '" + outputText + "', '" + intent + "', '" + entity + "','" + fullName + "','" + conversationId + "'," + intentConfidence + "," + entityConfidence + ");";
				//console.log("record response time query =>" + feedback_sql);
				var output = executeQuerySync(feedback_sql);
			}
		}
	}



}

/**
 * Updates the response text using the intent confidence
 * @method updateMessage
 * @param {Object} input The request to the Conversation service
 * @param {Object} response The response from the Conversation service
 * @return response
 */
function updateMessage(input, response) {
	//var responseText = null;
	//console.log("updateMessage=>" + response);
	if (response != null) {

		if (!response.output) {
			response.output = {};
		} else {
			lastOutputText = response.output.text;
			lastResponse = response;
			recordResponseTime(response); // record time for every conversation message to get time of chat for one intent.
			return response;
		}

	}
	//outputText = null;
	return response;
}


module.exports = app;

