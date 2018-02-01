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
var incidentFlow = false;
var all_output = null;
var lastUsedIntent = null;
var lastUsedEntity = null;
var userFullName = null;
var lastOutputText = null;
var oracleConnectionString = {
	user: dbConfig.user,
	password: dbConfig.password,
	connectString: dbConfig.connectString
};

var incidentTableName = "ARADMIN.HPD_HELP_DESK inc";
var incidentTableName_2 = "ARADMIN.HPD_HELP_DESK inc_2";
var taskTable = "ARADMIN.TMS_TASK";
var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,inc.ASSIGNED_GROUP,inc.RESOLUTION_CATEGORY_TIER_2 as RESOLUTION_CATEGORY_TIER_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

var incidentTableJoinTaskTable = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,tas.ASSIGNEE_GROUP as TASK_ASSIGNEE_GROUP,tas.ASSIGNEE as TASK_ASSIGNEE,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

var fiber = sync.fiber;
var await = sync.await;
var defer = sync.defer;

app.use('/', express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));


require('./utility/intenthandler.js')();
require('./utility/orchestration.js')();
require('./db/db-oracle.js')();
require('./db/db-mysql.js')();
require('./utility/stringhandler.js')();
require('./utility/contexthandler.js')();

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

	try {

		fiber(function () {
			

			conversationId = payload.context.conversation_id;
			response = getWatsonResponse(payload, sync);
			console.log(JSON.stringify(response));
			if (response != null) {
				response = startOverConversationWithContext(response);

				response = showChildIncidentsWithContext(response, sync, conversationId);

				response = showParentIncidentDetailsWithContext(response, sync);

				response = showMasterIncidentForRegionWithContext(response, sync, conversationId);

				response = regionIntentIsolatedFaultFlowWithContext(response, sync, conversationId);

				response = technologyTypeFlowWithContext(response, sync, conversationId);

				response = corporateCustomerFlowWithContext(response, sync);
			}
			//console.log("response =>" + JSON.stringify(response));

			if (response != null && response.context.cxt_user_logged_in) {

				console.log("user is logged in now checking intent");
				/* SITES intent and context variable code */
				response.output.text = handleSitesIntent(response, inputText, response.output.text, sync);

				/*Incident Intent Handling.*/
				response.output.text = handleIncidentIntent(response, inputText, incidentFlow, sync);


				/*Corporate Customer Intent handling.*/
				response.output.text = handleCustomerIntent(response, inputText, response.output.text, incidentFlow, sync);

				/*Region Intent Handling.*/
				response.output.text = handleRegionIntent(response, inputText, response.output.text, sync);

				/*
					transmission failure Intent handling.
				*/
				response.output.text = handleTransmissionFailureIntent(response, inputText, response.output.text, sync);
				/*
				Escalation Intent Handling.
				*/
				response.output.text = handleEscalationIntent(response, inputText, response.output.text, await, defer, discovery);


				console.log("response.context.cxt_location_list_trx_failure_query =>" + response.context.cxt_location_list_trx_failure_query);
				if (response != null && response.output.text[0] != null && response.context.cxt_location_list_trx_failure_query != null && response.context.cxt_location_name_trx_flow == null) {
					console.log("replacing location name in message if there are any.");
					response.output.text[0] = updateSuggestedLocationsInMessage(response.output.text[0], response.context.cxt_location_list_trx_failure_query, sync);
				}
			}

			response = userLoginWithContext(response);



			if (response) {
				all_output = response;
			}

			return res.json(updateMessage(payload, response));

		});  // fiber ends here


	} catch (err) {
		//TODO Handle error
		console.log("error=>" + JSON.stringify(err.stack));
	}
});

function sendMessageToWatson(app,request,sync) {

	var res = sync.await(app.post('/api/message',request, sync.defer()));
	return res;
}

function getWatsonResponse(payload, sync) {

	// Get a response to a user's input. conversation.message method takes user input in payload and returns watson response on that input in data object.
	var response = null;
	try {
		response = sync.await(conversation.message(payload, sync.defer()));

	} catch (err) {
		//TODO Handle error
		console.log("error=>" + JSON.stringify(err.message));
	}
	return response;


}





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
	if (feedbackReason && all_output) {
		//console.log(all_output);
		var feedback_value = -1; // -1 is for thumbs down
		recordFeedback(all_output, feedbackReason, feedback_value, feedbackReasonText,0);
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
		recordFeedback(all_output, null, feedback_value);
	}
})

app.get('/rating', function (req, res) {
	var query = url.parse(req.url, true).query;
	var ratingValue = query.ratingVal;
	
	if (ratingValue > 0) {
		console.log("ratingValue =>" + JSON.stringify(ratingValue));
		var recordInserted = recordFeedback(all_output, null, 1, null,ratingValue);
		if (recordInserted) {
			res.send('1');
		}
		
	}
	
	/*if (save_data && all_output) {
		recordFeedback(all_output, null, feedback_value);
	}*/
})

function recordFeedback(all_output, feedbackReason, feedback_value, feedbackReasonText,ratingValue) {
	console.log("feedbackReason =>" + JSON.stringify(feedbackReason));
	var input_text = all_output.input.text;
	if (input_text) {
		input_text = input_text;
	} else {
		input_text = "";
	}

	var output_text = striptags(outputText);

	if (outputText != null) {

		lastOutputText = striptags(outputText);
		lastOutputText = S(lastOutputText).replaceAll('?file', 'file').s;
		lastOutputText = S(lastOutputText).replaceAll("openExcelDownloadWindow('", "openExcelDownloadWindow").s;
		lastOutputText = S(lastOutputText).replaceAll("')>Download", "Download").s;
		
		//lastOutputText = S(lastOutputText).escapeHTML().s;
	} else {
		lastOutputText = striptags(lastOutputText);
		lastOutputText = S(lastOutputText).replaceAll('?file', 'file').s;
		lastOutputText = S(lastOutputText).replaceAll("openExcelDownloadWindow('", "openExcelDownloadWindow").s;
		lastOutputText = S(lastOutputText).replaceAll("')>Download", "Download").s;
	}


	var intents = all_output.intents;
	var intent = null;
	if (intents[0] != null) {
		intent = intents[0].intent;
	}

	var entities = all_output.entities;
	var entity = null;
	if (entities[0] != null) {

		entity = entities[0].entity;
	}
	var feeds = feedback_value;
	if (all_output.context.cxt_user_full_name != null) {
		userFullName = all_output.context.cxt_user_full_name;
	}
	if (intent != null) {
		lastUsedIntent = intent;
	}
	if (entity != null) {
		lastUsedEntity = entity;
	}
	console.log("last used intent" + JSON.stringify(lastUsedIntent));
	var feedback_sql = '';
	if (ratingValue > 0) {
		console.log("Insert feedback with rating =>" + JSON.stringify(ratingValue));
		feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, feedback,username,conversationId,rating_value) VALUES ('" + inputText + "', '" + lastOutputText + "', '" + lastUsedIntent + "', '" + lastUsedEntity + "', '" + feeds + "','" + userFullName + "','" + all_output.context.conversation_id + "',"+ratingValue+");";
	} else{
		feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, feedback,username,conversationId,feedback_comment,feedback_comment_other) VALUES ('" + inputText + "', '" + lastOutputText + "', '" + lastUsedIntent + "', '" + lastUsedEntity + "', '" + feeds + "','" + userFullName + "','" + all_output.context.conversation_id + "'," + feedbackReason + ",'" + feedbackReasonText + "');";
	}
	//console.log("query insert feedback =>" + feedback_sql);
	var output = executeQuerySync(feedback_sql);
	console.log("output =>" + JSON.stringify(output));
	if (output.success) {
		console.log("Feedback Inserted into database");
		return true;
	} else {
		return false;
	}
}

function recordResponseTime(response) {
	console.log("recordResponseTime");
	var intent = null;
	var entity = null;
	var conversationId = null;
	var fullName = null;
	if (response != null) {
		//console.log(response);
		if (response.intents[0] != null) {
			intent = response.intents[0].intent;
			lastUsedIntent = intent;
		}
		if (response.entities[0] != null) {
			entity = response.entities[0].entity;
			lastUsedEntity = entity;
		}
		conversationId = response.context.conversation_id;
		fullName = response.context.cxt_user_full_name;
		var feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, username,conversationId) VALUES ('" + inputText + "', '" + striptags(outputText) + "', '" + intent + "', '" + entity + "','" + fullName + "','" + conversationId + "');";
		//console.log("query insert feedback =>" + feedback_sql);
		var output = executeQuerySync(feedback_sql);
	}



}

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
	//var responseText = null;
	console.log("updateMessage=>" + response);
	if (response != null) {

		if (!response.output) {
			response.output = {};
		} else {
			lastOutputText = response.output.text;
			recordResponseTime(response); // record time for every conversation message to get time of chat for one intent.
			return response;
		}

	}
	//outputText = null;
	return response;
}


module.exports = app;

