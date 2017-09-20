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
var mysql = require('mysql');
var uuid = require('uuid');
var sync = require('synchronize');
var Regex = require('regex');
var syncSql = require('sync-sql');
var express = require('express'); // app server
var S = require('string');
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
var logs = null;
var connection = null;
var inputText = null;
var outputText = null;
var regexTest = null;
var conversationId = null;
var incidentFlow = false;
var excelGenerationRecordCountLimit = 10;
var app = express();
var striptags = require('striptags');
var excelbuilder = require('msexcel-builder');
var all_output = null;
var lastUsedIntent = null;
var lastUsedEntity = null;
var userFullName = null;
var lastOutputText = null;

// Bootstrap application settings
//app.use(express.static('./public')); // load UI from public folder
app.use('/', express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

var fiber = sync.fiber;
var await = sync.await;
var defer = sync.defer;
// Create the service wrapper
var conversation = new Conversation({
	// If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
	// After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
	// username: '<username>',
	// password: '<password>',
	url: 'https://gateway.watsonplatform.net/conversation/api',
	version_date: '2016-10-21',
	version: 'v1'
});

var discovery = new DiscoveryV1({ username: 'c1b5ad82-29a4-49c6-b200-72342832a0e3', password: 'pHm6uCkpdnoJ', version_date: '2017-07-19' })


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
	//dbConnection = createDBConnection ();
	// Send the input to the conversation service

	conversation.message(payload, function (err, data) {
		try {
			fiber(function () {
				if (err) {
					//return res.status(err.code || 500).json(err);
					res.status(err.code >= 100 && err.code < 600 ? err.code : 500);
				}
				if (req.body.input != null) {
					inputText = req.body.input.text;
					//console.log("Input provided is => "+req.body.input.text);
				}
				outputText = null;
				conversationId = payload.context.conversation_id;
				//	console.log("i am here");
				// handle context variable case here
				// show incident details intent 1 :: showing master of child.





				if (data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_incident_number != null && data.context.cxt_incident_number != -1 && data.context.cxt_is_master_incident != null && data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>" + data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>" + data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>" + data.context.cxt_show_anything_else_msg);
					var childsql = "Select * from incidents where parent_incident_number = '" + data.context.cxt_incident_number + "';";
					console.log("query from context variable =>" + childsql);
					var childoutput = executeQuerySync(childsql);
					outputText = showChildIncidents(childoutput.data.rows, outputText, data, conversationId);
					data.context.cxt_show_incident_details = false;
					data.context.cxt_show_anything_else_msg = true;

				}
				//console.log("i am here 2");
				// show incident details intent 1 :: showing child of master
				if (data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_parent_incident_number != null && data.context.cxt_parent_incident_number != -1 && data.context.cxt_is_master_incident != null && !data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>"+ data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>"+ data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>"+ data.context.cxt_show_anything_else_msg);

					var childsql = "Select * from incidents where incident_number = '" + data.context.cxt_parent_incident_number + "';";
					console.log("query from context variable =>" + childsql);
					var childoutput = executeQuerySync(childsql);
					outputText = showParentIncidentDetails(childoutput.data.rows, outputText, data);
					data.context.cxt_show_anything_else_msg = true;
					data.context.cxt_show_incident_details = false;
					data.context.cxt_parent_incident_number = -1;
					data.context.cxt_parent_incident_number = -1;


				}
				//	console.log("i am here 3");
				// intent 2 :: Master Incident

				if (data.context.cxt_region_show_master_incident) {

					console.log("data.context.cxt_region_name =>" + data.context.cxt_region_name);
					var regionLookupQuery = "Select * from region_lookup where (full_name like '" + data.context.cxt_region_name + "' OR abbreviation like '" + data.context.cxt_region_name + "')";

					console.log("region lookup query for customer intent. =>" + regionLookupQuery);
					var lookupResult = executeQuerySync(regionLookupQuery);
					if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
						customerRegion = lookupResult.data.rows[0].full_name;
					}
					var childsql = "Select count(i.incident_number) as count ,i2.status,i.parent_incident_number,i2.site_name,i2.summary,i2.region from incidents i inner join incidents i2 on (i.parent_incident_number = i2.incident_number) where i.region like '%" + customerRegion + "%' and i.parent_incident_number is not null and LOWER(i.status) != 'closed' and LOWER(i2.status) != 'closed' group by i.parent_incident_number order by count desc";
					console.log("query to get Master Incident from context variable =>" + childsql);
					var masterIncidentsDetailsResult = executeQuerySync(childsql);
					console.log(masterIncidentsDetailsResult.data.rows.length);
					// if no master found with child association list all masters that are found for the region.
					if (masterIncidentsDetailsResult.data.rows.length == 0) {
						childsql = "Select i.incident_number,i.status,i.parent_incident_number,i.site_name,i.summary,i.region from incidents i where i.region like '%" + customerRegion + "%' and i.parent_incident_number is null and LOWER(i.status) != 'closed'";
						console.log("query to get Master Incident from context variable =>" + childsql);
						masterIncidentsDetailsResult = executeQuerySync(childsql);
						outputText = DisplyDetailsForMasterIncidents(masterIncidentsDetailsResult.data.rows, outputText, data, conversationId);

					} else {
						outputText = showMasterIncidentsForRegion(masterIncidentsDetailsResult.data.rows, outputText, data, conversationId);
					}
					data.context.cxt_region_show_master_incident = false;
					data.context.cxt_region_name = null;

				}
				//	console.log("i am here 4");
				// intent 2 :: isolated fault
				// site name or node name flow
				if (data.context.cxt_region_show_isolated_fault && data.context.cxt_site_name_region_flow == null && !data.context.cxt_region_flow_search_for_location) {
					// update message for entering site with actual sites in region of query.
					if (data.context.cxt_region_full_name != null) {
						var listOfSitesQuery = "SELECT distinct site_name FROM `incidents` WHERE region like '%" + data.context.cxt_region_full_name + "%' limit 10;";
						console.log("listOfSitesQuery =>" + listOfSitesQuery);
						var listOfSitesOutput = executeQuerySync(listOfSitesQuery);
						if (listOfSitesOutput != null && listOfSitesOutput.data.rows.length > 0) {
							outputText = "Do you know the site or node name. Common names in " + data.context.cxt_region_full_name + " are <br/>";
							for (i = 0; i < listOfSitesOutput.data.rows.length; i++) {
								if (i > 0 && i % 4 == 0) {
									outputText += "<br/>";
								}
								outputText += listOfSitesOutput.data.rows[i].site_name;
								if (i < listOfSitesOutput.data.rows.length - 1)
									outputText += ",&nbsp;";


							}

							outputText += "<br/><br/> <b>If you do not know the site or node name select No to search based on Location</b>";
						}
						data.context.cxt_region_full_name = null;
					}

				}
				if (data.context.cxt_region_show_isolated_fault && data.context.cxt_site_name_region_flow != null) {


					console.log("data.context.cxt_site_name_region_show_incident_detail=>" + data.context.cxt_site_name_region_show_incident_detail);
					var siteName = data.context.cxt_site_name_region_flow;
					//var sitenameSql = "Select * from config_info where 2g_sitename like '" + siteName + "' OR 3g_sitename like '" + siteName + "' OR 4g_sitename like '" + siteName + "' and region like '" + data.context.cxt_region_name + "'";
					var sitenameSql = "SELECT distinct ci_name FROM `locations_lookup` WHERE `ci_name` LIKE '%" + siteName + "%';";
					console.log("Query for matching site name in config_info table. =>" + sitenameSql);
					var sitenameOutput = executeQuerySync(sitenameSql);
					if (sitenameOutput != null && sitenameOutput.data.rows != null && sitenameOutput.data.rows.length >= 1) {
						// site name found
						data.context.cxt_site_name_region_flow_found = true;
						if (data.context.cxt_site_name_region_show_incident_detail) {

							console.log("incidents found for site name " + data.context.cxt_site_name_region_flow);
							var incidentSql = "Select * from incidents where site_name like '%" + data.context.cxt_site_name_region_flow + "%'";// and Lower(status) != 'closed' ;";
							console.log("query from context variable =>" + incidentSql);
							var incidentOutput = executeQuerySync(incidentSql);
							outputText = showIncidentsForSiteName(incidentOutput.data.rows, outputText, data, conversationId); // this method is used for displaying incident information
							data.context.cxt_site_name_region_flow_found = false;
							data.context.cxt_site_name_region_flow = null;


						} else {
							data.context.cxt_site_name_region_show_incident_detail = true;
						}

					} else {
						// will look for nodes now.

						var nodeName = data.context.cxt_site_name_region_flow;
						var nodeNameSql = "Select * from nodes_lookup where node like '" + nodeName + "'";
						console.log("Query for matching node name in nodes_lookup table. =>" + nodeNameSql);
						var nodenameOutput = executeQuerySync(nodeNameSql);
						if (nodenameOutput != null && nodenameOutput.data.rows != null && nodenameOutput.data.rows.length > 0) {
							// node is found instead of sitename we will follow the region flow for site name.

							data.context.cxt_site_name_region_flow_found = true; // setting flag to true to avoid site name not found message.

							if (data.context.cxt_site_name_region_show_incident_detail) {

								data.context.cxt_location_name_region_flow = nodenameOutput.data.rows[0].location;
								// when we assign fetched location to context variable the location name flow will run after this.
								data.context.cxt_site_name_region_flow = null;
								data.context.cxt_site_name_region_flow_found = false;
							} else {
								data.context.cxt_site_name_region_show_incident_detail = true;
							}
							//outputText = data.output.text[0];
						}


					}


					if (data.context.cxt_site_name_region_flow_found && data.context.cxt_site_name_region_flow != null) {
						outputText = "Site name found do you want to see its incidents, reply with yes.";
						data.context.cxt_site_name_region_flow_found = true;
						data.context.cxt_site_name_region_show_incident_detail = true;


					}
					if (!data.context.cxt_site_name_region_flow_found && !data.context.cxt_site_name_region_show_incident_detail && !data.context.cxt_region_flow_search_for_location) {
						outputText = "Site name <b>not</b> found do you want to search with location? reply with <b>yes</b>.";
						data.context.cxt_region_flow_search_for_location = true;
						data.context.cxt_site_name_region_flow = null;
					}
					console.log("outputText=>" + outputText);
					console.log("Region Flow => data.context.cxt_site_name_region_show_incident_detail=>" + data.context.cxt_site_name_region_show_incident_detail);
				}
				//console.log("i am here 5");
				if (data.context.cxt_location_name_region_flow != null) {
					data.context.cxt_location_name_region_flow_found = true;
					console.log("data.context.cxt_location_name_region_flow_found =>" + data.context.cxt_location_name_region_flow_found);
					var locationSql = "Select * from locations_lookup where location_name like '%" + data.context.cxt_location_name_region_flow + "%'";
					console.log("location query from context variable =>" + locationSql);
					var locationOutput = executeQuerySync(locationSql);
					var inOperator = "(";
					console.log("site names on location =>" + locationOutput.data.rows.length);
					if (locationOutput.data.rows.length > 0) {
						for (i = 0; i < locationOutput.data.rows.length; i++) {

							inOperator += "'" + locationOutput.data.rows[i].ci_name + "'";

							if (i < locationOutput.data.rows.length - 1) {
								inOperator += ",";
							}


						}
						inOperator += ")";
						console.log(inOperator);
						var incidentSql = "Select * from incidents where site_name in " + inOperator + " and Lower(status) != 'closed';";
						console.log(incidentSql);
						var incidentOutput = executeQuerySync(incidentSql);
						data.context.cxt_region_flow_search_for_location = false;
						data.context.cxt_region_full_name = null;
						outputText = showIncidentsForRegionBasedOnLocation(incidentOutput.data.rows, outputText, data, conversationId);
					} else {

						outputText = "Sorry the entered location is <b>not</b> found. <br/><br/>" + data.output.text[0];
					}

					data.context.cxt_location_name_region_flow_found = false;
					data.context.cxt_location_name_region_flow = null;


				}
				//console.log("i am here 6");
				// transmission location flow : intent
				if (data.context.cxt_location_name_trx_flow != null) {

					console.log("data.context.cxt_location_name_trx_flow =>" + data.context.cxt_location_name_trx_flow);
					//var locationSql = "Select object_class from locations_lookup where location_name like '%" + data.context.cxt_location_name_trx_flow + "%'";

					var locationSql = "SELECT distinct ci_name FROM locations_lookup l inner join tech_location_mapping lm ON l.object_class = lm.core_ecs WHERE l.remedy_location_name LIKE '%" + data.context.cxt_location_name_trx_flow + "%' AND lm.tech_type like '%" + data.context.cxt_tx_name + "%'";
					console.log("location query from context variable =>" + locationSql);
					var locationOutput = executeQuerySync(locationSql);
					console.log("locationOutput.data.rows.length =>" + locationOutput.data.rows.length);
					var inOperator = "(";
					if (locationOutput.data.rows.length > 0) {

						data.context.cxt_location_name_trx_flow_found = true;
						for (i = 0; i < locationOutput.data.rows.length; i++) {

							inOperator += "'" + locationOutput.data.rows[i].ci_name + "'";

							if (i < locationOutput.data.rows.length - 1) {
								inOperator += ",";
							}


						}
						inOperator += ")";
						var incidentSql = "Select * from incidents where site_name in " + inOperator + " and cause_tier_1 like '" + data.context.cxt_tx_name + "' and Lower(status) != 'closed' and (parent_incident_number is null OR parent_incident_number = '')";
						console.log("incident sql =>" + incidentSql);
						var incidentOutput = executeQuerySync(incidentSql);
						outputText = showIncidentsForTransmissionFailureOnLocation(incidentOutput.data.rows, outputText, data, conversationId);
						data.context.cxt_tx_name = null;

					} else {
						// location not found.
						data.context.cxt_location_name_trx_flow = null;
						data.context.cxt_location_name_trx_flow_found = false;
					}


				} else {
					// update location message for Transmission failure here.	


				}

				// customer flow using context variables.
				if (data.context.cxt_customer_flow_node_detail_query_executed) {
					console.log("customer flow context variable cleared");
					data.context.cxt_show_customer_selected_name = null;
					data.context.cxt_matched_customer_name = null;
					data.context.cxt_customer_flow_found = null;
					data.context.cxt_show_customer_multiple_record_found = null;
					data.context.cxt_run_customer_search_query = null;
					data.context.cxt_customer_query = null;
					data.context.cxt_matched_customer_count = 0;
					data.context.cxt_customer_flow_node_detail_query_executed = false;
					data.context.cxt_customer_flow_vlan_id = null;
					// this below code will handle if user ask another customer after one customer flow ends.
					for (i = 0; i < data.entities.length; i++) {

						if (data.entities[i] != null && data.entities[i].entity == 'corporate-customers') {
							data.context.cxt_matched_customer_name = data.entities[i].value;
							data.context.cxt_customer_flow_found = true;
							//data.context.cxt_matched_customer_name = customerName;
						}
					}



				}
				//console.log("i am here 8");
				if (data.context.cxt_customer_flow_found != null) {
					console.log("data.context.cxt_customer_flow_found=>" + data.context.cxt_customer_flow_found);
					var customerName = null;
					console.log("data.context.cxt_matched_customer_name=>" + data.context.cxt_matched_customer_name);
					if (data.context.cxt_matched_customer_name != null) {

						customerName = data.context.cxt_matched_customer_name;
					}
					var isL3Service = null;
					if (data.context.cxt_customer_flow_L3_service != null) {
						console.log("data.context.cxt_customer_flow_L3_service=>" + data.context.cxt_customer_flow_L3_service);
						isL3Service = data.context.cxt_customer_flow_L3_service;
					}
					var customerVlanId = null;
					if (data.context.cxt_customer_flow_vlan_id != null) {
						console.log("data.context.cxt_customer_flow_vlan_id=>" + data.context.cxt_customer_flow_vlan_id);
						customerVlanId = data.context.cxt_customer_flow_vlan_id;
					}
					var customerMSR = null;
					if (data.context.cxt_customer_msr_text != null) {
						console.log("data.context.cxt.cxt_customer_msr_text=>" + data.context.cxt_customer_msr_text);
						customerMSR = data.context.cxt_customer_msr_text;
					}
					var customerRegion = null; //
					if (data.context.cxt_customer_location_text != null) {
						console.log("data.context.cxt_customer_location_text=>" + data.context.cxt_customer_location_text);
						customerRegion = data.context.cxt_customer_location_text;
					}

					var sql = "Select * from vlan_msr ";
					if (customerName != null) {
						sql += " where MPLSVPN_NAME like '%" + customerName + "%'";

					}
					if (customerMSR != null) {
						sql += " and MPLSVPN_NAME like '%" + customerMSR + "%'";

					}
					if (customerRegion != null) {
						var regionLookupQuery = "Select * from region_lookup where (full_name like '" + customerRegion + "' OR abbreviation like '" + customerRegion + "')";

						console.log("region lookup query for customer intent. =>" + regionLookupQuery);
						var lookupResult = executeQuerySync(regionLookupQuery);
						if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
							customerRegion = lookupResult.data.rows[0].abbreviation;
						}
						sql += " and MPLSVPN_NAME like '%" + customerRegion + "%'";

					}

					if (customerVlanId != null) {
						sql += " and IFACE_VLANID = '" + customerVlanId + "'";

					}

					sql += ";";
					data.context.cxt_customer_query = sql;

					if ((customerMSR != null || customerRegion != null) && customerVlanId != null) {
						var output = executeQuerySync(sql);

						data.context.cxt_matched_customer_count = output.data.rows.length;
						outputText = data.output.text[0];
						outputText = S(outputText).replaceAll('[no_of_records]', "<b>" + output.data.rows.length + "</b>").s;
						//console.log("outputText=>"+outputText);
						if (data.context.cxt_show_customer_details && !data.context.cxt_show_customer_multiple_record_found) {

							console.log("in show customer detail check success =>" + data.context.cxt_show_customer_details);

							if (data.context.cxt_matched_customer_count > 1) {
								outputText = data.output.text[0];
								outputText += "<table class='w-50'><tr>";
								for (i = 0; i < data.context.cxt_matched_customer_count; i++) {
									outputText += "<td>";
									outputText += output.data.rows[i].MPLSVPN_NAME + "<br/>" + output.data.rows[i].IFNR + "<br/>" + output.data.rows[i].IFALIAS + "<br/>"
										+ output.data.rows[i].IFACCURSTRING + "<br/>" + output.data.rows[i].NID + "<br/>" + output.data.rows[i].NODE_NM + "<br/><br/>";
									outputText += "</td>";

								}
								outputText += "</tr></table>";
							}
							if (data.context.cxt_matched_customer_count == 1) {

								outputText = output.data.rows[0].MPLSVPN_NAME + "<br/>" + data.output.text[0];

							}
						}
						console.log("data.context.cxt_show_customer_selected_name=>" + data.context.cxt_show_customer_selected_name);
						if (data.context.cxt_show_customer_multiple_record_found) {
							data.context.cxt_customer_flow_node_detail_query_executed = true; // this flag will help to clear the context variables for customer.
							//var sql = "Select * from vlan_msr ";

							//sql += " where MPLSVPN_NAME like '%" +data.context.cxt_show_customer_selected_name.trim()+ "%'";
							var sql = data.context.cxt_customer_query;
							console.log(sql);
							output = executeQuerySync(sql);

							//outputText = "Please see summary of the end point for " + data.context.cxt_show_customer_selected_name + "<br/>";
							//outputText += output.data.rows[0].MPLSVPN_NAME + "<br/>" + output.data.rows[0].IFNR + "<br/>" + output.data.rows[0].IFALIAS + "<br/>"
							//	+ output.data.rows[0].IFACCURSTRING + "<br/>" + output.data.rows[0].NID + "<br/>" + output.data.rows[0].NODE_NM + "<br/><br/>";
							var nodeId = output.data.rows[0].NID;

							var nodeSql = "select * from incidents where site_name like '%" + nodeId + "%'";
							for (j = 0; j < output.data.rows.length; j++) {
								nodeId = output.data.rows[j].NID;
								nodeSql += " OR site_name like '%" + nodeId + "%'"
							}
							console.log(nodeSql);
							output = executeQuerySync(nodeSql);
							console.log(output.data.rows);
							if (output != null && output.data.rows.length == 0) {

								outputText = "<b>I could not find any data for this issue in Remedy. If you like to speak to an operator please dial 082918.<br/></b>";


								//data.context.cxt_show_customer_selected_name = null;


							} else {

								outputText = "<table class='w-50'>";
								outputText += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
								for (i = 0; i < output.data.rows.length; i++) {


									outputText += "<tr><td>" + output.data.rows[i].incident_number + "</td><td>" + output.data.rows[i].summary + "</td><td>" + output.data.rows[i].status + "</td><td>" + output.data.rows[i].site_name + "</td></tr>";

								}
								outputText += "</table><br/>";
								//data.context.cxt_show_customer_selected_name = null;



							}
							outputText = addFeedbackButton(outputText);
							outputText += "<br/>" + data.output.text[0];

						}
					}


				}

				if (data.context.cxt_user_logged_in) {
					/* SITES intent and context variable code */
					outputText = handleSitesIntent(data, inputText, outputText);

					/*Incident Intent Handling.*/
					outputText = handleIncidentIntent(data, inputText, outputText, incidentFlow);


					/*Region Intent Handling.*/
					outputText = handleRegionIntent(data, inputText, outputText);



					/*Corporate Customer Intent handling.*/
					outputText = handleCustomerIntent(data, inputText, outputText, incidentFlow);


					/*
						transmission failure Intent handling.
					*/
					outputText = handleTransmissionFailureIntent(data, inputText, outputText);


					/*
					Escalation Intent Handling.
					*/
					outputText = handleEscalationIntent(data, inputText, outputText);


					//console.log("replacing location name in message if there are any.");
					if (data.output.text[0] != null && S(data.output.text[0]).contains('Common locations are') && data.context.cxt_location_name_trx_flow == null && data.context.cxt_region_name != null) {
						//console.log("replacing location name in message if there are any.");
						data.output.text[0] = updateSuggestedLocationsInMessage(data.output.text[0], data.context.cxt_region_name);
					}
				}

				if (!data.context.cxt_user_logged_in && data.context.cxt_verify_user) {
					console.log("verifying user credentials");

					if (data.context.cxt_user_email != null && data.context.cxt_user_password != null) {
						var loginQuery = "Select * from bot_users where email = '" + data.context.cxt_user_email + "' and password = '" + data.context.cxt_user_password + "';";
						var loginOutPut = executeQuerySync(loginQuery);
						if (loginOutPut.data.rows.length != 0) {
							console.log("credentials verified");
							data.context.cxt_user_logged_in = true;
							data.context.cxt_user_full_name = loginOutPut.data.rows[0].first_name + " " + loginOutPut.data.rows[0].last_name;
							userFullName = data.context.cxt_user_full_name;
							//outputText = data.output.text[0];//"Your credentials are verified. You are now logged in. ";
							console.log(data);
						} else {

							//if ()
							outputText = data.output.text[0];
							if (data.output.text[1]!= null) {
								outputText += data.output.text[1];
							}
							//console.log(outputText);
							data.context.cxt_user_email = null;
							data.context.cxt_user_password = null;
							data.context.cxt_user_logged_in = false;
							data.context.cxt_verify_user = false;
						}
					}


				}

				//console.log("data is =>" + JSON.stringify(data));
				all_output = data;
				return res.json(updateMessage(payload, data));
			});
		} catch (err) {
			//TODO Handle error
		}


	});


});



function handleSitesIntent(data, inputText, outputText) {
	console.log("handleSitesIntent");
	if (data.context.cxt_ci_flow_site_name != null) {
		console.log("sites intent context variable checks");
		var lookForSiteNames = "Select ci_name from locations_lookup where ci_name = '" + data.context.cxt_ci_flow_site_name + "'";
		var lookForSiteNamesData = executeQuerySync(lookForSiteNames);

		if (lookForSiteNamesData != null && lookForSiteNamesData.data.rows.length > 0) {
			// look for incident based on the site.
			console.log("site name found in db");
			data.context.cxt_ci_site_name_found_in_db = true;

		} else {
			// site name not found
			console.log("site name not found in db");
			data.context.cxt_ci_site_name_found_in_db = false;
			outputText = "Site name <b>not</b> found. Would you like to do another search? reply with <b>yes,</b> or <b>no</b>.";
			data.context.cxt_ci_flow_site_name = null;

		}
		console.log("data.context.cxt_ci_flow_show_incident=>" + data.context.cxt_ci_flow_show_incident);
		if (data.context.cxt_ci_site_name_found_in_db && data.context.cxt_ci_flow_show_incident) {
			var childCount = 0;
			var incidentSql = "Select * from incidents where site_name like '%" + data.context.cxt_ci_flow_site_name + "%'";
			var incidentResult = executeQuerySync(incidentSql);
			outputText = showIncidentsForSiteName(incidentResult.data.rows, outputText, data, conversationId);
			data.context.cxt_ci_site_name_found_in_db = false;
			data.context.cxt_ci_flow_site_name = null;
		}
	}
	return outputText;

}

function handleTransmissionFailureIntent(data, inputText, outputText) {

	if (data != null && data.intents[0] != null && data.intents[0].intent == "tier-cause-transmission-failure" || (data != null && data.entities[0] != null && data.entities[0].entity == "transmission-failures")) {

		console.log("handleTransmissionFailureIntent");

		//console.log(JSON.stringify(data));
		var tier_cause_search_term = null;
		var output = null;
		var sql = null;
		for (i = 0; i < data.entities.length; i++) {

			if (data.entities[i] != null && data.entities[i].entity == 'transmission-failures') {
				tier_cause_search_term = data.entities[i].value;
			}
		}


		if (tier_cause_search_term != null) {

			data.context.cxt_tx_name = tier_cause_search_term;
			sql = "Select distinct incident_number,cause_tier_1,count(*) as incidentCount from incidents where cause_tier_1 like '" + tier_cause_search_term + "' and Lower(status) != 'closed';";
			console.log(sql);
			output = executeQuerySync(sql);
		}

		if (output != null) {
			if (output.data.rows != null && output.data.rows.length > 0) {

				outputText = orchestrateBotResponseTextForTransmissionFailures(output.data.rows, data.output.text, data);
			}
			if (output.data.rows.length == 0) {
				//console.log("in not found message.");
				outputText = "Sorry, <b>no</b> open incidents have been found because of <b>" + tier_cause_search_term + "</b>";
			}

		}

	}

	return outputText;

}

function handleCustomerIntent(data, inputText, outputText, incidentFlow) {

	if (data != null && data.intents[0] == 'corporate-customer' || data.context.cxt_show_customer_selected_name == null) {

		if (!incidentFlow) { // if someone search customer with query like status of customer name then this check will handle the triggering of customer.
			console.log("handleCustomerIntent");

			//&& data.entities[0] != null && data.entities[0].entity == "corporate-customers" && data.entities[0].confidence > 0.5
			//console.log(JSON.stringify(data));
			var customerName = null;
			for (i = 0; i < data.entities.length; i++) {

				if (data.entities[i] != null && data.entities[i].entity == 'corporate-customers') {
					customerName = data.entities[i].value;
					//data.context.cxt_matched_customer_name = customerName;
				}
			}

			console.log("customer name =>" + customerName);
			//console.log(JSON.stringify(data));
			if (customerName != null) {

				var sql = "Select * from vlan_msr where REPLACE(REPLACE(MPLSVPN_NAME, '_', ' '), '-', ' ') like '%" + customerName + "%';";
				console.log("customer sql =>" + sql);
				var output = executeQuerySync(sql);
				outputText = orchestrateBotResponseTextForCustomer(output.data.rows, data.output.text, customerName, data);

			}
		}

	}

	return outputText;

}

function handleRegionIntent(data, inputText, outputText) {

	if (data != null && data.entities != null && data.entities[0] != 'escalation' && data.context.cxt_matched_customer_name == null && (data.intents[0] != null && data.intents[0].intent == "regions" && data.intents[0].confidence > 0.5)) {

		if (data.entities != null && data.entities.length <= 3

			&& ((data.entities[0] != null && data.entities[0].entity == "regions") || (data.entities[1] != null && data.entities[1].entity == "regions") || (data.entities[0] != null && data.entities[0].entity == "sys-location" || data.entities[1] != null && data.entities[1].entity == "sys-location"))

		) {
			console.log("handleRegionIntent");


			var regionName_1 = "";
			var fullName = "";
			if (data.entities[0] != null && data.entities[0].entity != "escalation" && data.entities[0].entity != "incidents") {
				regionName_1 = data.entities[0].value;
			} else {

				regionName_1 = data.entities[1].value;
			}


			data.context.cxt_region_name = regionName_1;
			console.log("region name =>" + regionName_1);
			if (regionName_1 != "region") {


				var regionLookupQuery = "Select * from region_lookup where (abbreviation like '" + regionName_1 + "' OR full_name like '" + regionName_1 + "')";

				console.log("lookup query =>" + regionLookupQuery);
				var lookupResult = executeQuerySync(regionLookupQuery);
				if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
					regionName_1 = lookupResult.data.rows[0].full_name;
				}
				data.context.cxt_region_full_name = regionName_1;
				var regionName_2 = S(regionName_1).replaceAll('Africa', "").s;
				regionName_2 = S(regionName_2).replaceAll('africa', "").s;
				regionName_2 = S(regionName_2).s;
				var sql = "Select distinct(incident_number),count(*) as incidentCount,region,parent_incident_number from incidents where region like '%" + regionName_1 + "%' and LOWER(status) != 'closed' order by parent_incident_number desc ;";
				console.log("get incidents details for region =>" + sql);
				var output = executeQuerySync(sql);



				if (output.data.rows != null && output.data.rows.length >= 1) {
					outputText = orchestrateBotResponseTextForRegion(output.data.rows, data.output.text, regionName_1, data);
				}
				if (output.data.rows.length == 0) {
					if (regionName_1 != null)
						outputText = "Sorry, no result can be found against given region " + regionName_1;
				}

			} else {
				outputText = "Sorry, you have not provided a region name.";
			}
			//console.log(JSON.stringify(data));
		}
	}

	return outputText;

}


function handleIncidentIntent(data, inputText, outputText, incidentFlow) {

	var goToIncidentIntent = false;


	if (data.context.cxt_location_name_trx_flow == null && data.context.cxt_tx_name == null && data.context.cxt_region_name == null && data.context.cxt_matched_customer_name == null && data.context.cxt_ci_flow_site_name == null && data.context.cxt_customer_flow_vlan_id == null) {
		goToIncidentIntent = true;
		if (data.entities[0] != null && data.entities[0].entity == '2g-sites') {
			goToIncidentIntent = false;
		}


	}
	console.log("goToIncidentIntent=>" + goToIncidentIntent);

	if ((data != null && data.intents[0] != null && data.intents[0].intent == "incident" && goToIncidentIntent) || (data != null && data.entities[0] != null && data.entities[0].entity != 'sys-date' && data.intents[0].intent != "sites" && data.intents[0].intent != "regions" && data.entities[0].entity == "incidents" && goToIncidentIntent)) {

		console.log("handleIncidentIntent");
		incidentFlow = true;
		//console.log(JSON.stringify(data));
		if (inputText != null) {
			regexTest = inputText.match(/INC[0-9]+/i);

			var incidentNumber = false;
			if (regexTest != null) {
				incidentNumber = regexTest[0];
			} else {

				for (i = 0; i < data.entities.length; i++) {

					if (data.entities[i].entity == 'sys-number') {
						incidentNumber = data.entities[i].value;
					}
				}

			}

			console.log(JSON.stringify(incidentNumber));
			if (incidentNumber) {
				var incident_no_str = incidentNumber;
				incidentNumber = S(incidentNumber).replaceAll('INC', '').s;
				incidentNumber = S(incidentNumber).replaceAll('inc', '').s;
				var sql = "Select * from incidents where incident_number like '%" + incidentNumber + "%';";
				console.log(sql);
				var output = executeQuerySync(sql);

				var childsql = "Select count(*) as incidentCount from incidents where parent_incident_number like '%" + incidentNumber + "%';";
				var childoutput = executeQuerySync(childsql);
				var childCount = 0;

				if (childoutput != null && childoutput.data.rows != null) {
					console.log("child count for incident =>" + childoutput.data.rows[0].incidentCount);
					childCount = childoutput.data.rows[0].incidentCount;
				}
				console.log("checking output condition");
				if (output != null) {
					console.log("out put is not null");
					if (output.data.rows != null && output.data.rows.length > 0) {
						console.log("found incident");
						outputText = orchestrateBotResponseTextForIncident(output.data.rows, data.output.text, data, childCount);
					}
					if (output.data.rows.length == 0) {
						console.log("in not found message.");
						outputText = "Sorry, no result can be found against given incident number " + incident_no_str + ". Please provide with a different incident number.";
					} else {
						console.log("incident" + incident_no_str + " found");
					}

				} else {
					console.log("out put is null");
					outputText = "Sorry, no result can be found against given incident number " + incident_no_str + " in remedy. Please provide with a different incident number.";
				}
			} else {
				console.log("last else =>");
				outputText = "Yes sure, please provide me with the incident number.";
			}
			// handling the case for problems,change requests and tasks.
			console.log("testing problem change and task =>");
			regexTest = inputText.match(/PBI[0-9]+/i);
			if (regexTest != null) {
				outputText = "I am only trained to search Incidents, I cannot search problem refs.";
			}
			regexTest = inputText.match(/CRQ[0-9]+/i);
			if (regexTest != null) {
				outputText = "I am only trained to search Incidents, I cannot search change refs.";
			}
			regexTest = inputText.match(/CR[0-9]+/i);
			if (regexTest != null) {
				outputText = "I am only trained to search Incidents, I cannot search change refs.";

			}
			regexTest = inputText.match(/TAS[0-9]+/i);
			if (regexTest != null) {
				outputText = "I am only trained to search Incidents, I cannot search Task refs.";
			}

		}

	}

	return outputText;

}

function handleEscalationIntent(data, inputText, outputText) {

	if (data != null && data.intents[0] != null && data.intents[0].intent == "escalation" && data.intents[0].confidence > 0.5 || (data.entities[0] != null && data.entities[0] == 'escalation')) {
		console.log("handleEscalationIntent");
		inputText = S(inputText).replaceAll('shift', '').s;
		inputText = S(inputText).replaceAll('report', '').s;
		inputText = S(inputText).replaceAll('shiftreport', '').s;
		inputText = S(inputText).replaceAll('major', '').s;
		inputText = S(inputText).replaceAll('escalation', '').s;
		inputText = S(inputText).replaceAll('majorescalation', '').s;
		console.log("escaltion =>" + inputText);
		datadisc = await(discovery.query({ environment_id: 'dd11900a-3044-4afa-866c-7cea550e2a89', collection_id: '7fd6953a-0e57-44b4-be48-0d35ff1de239', query: inputText, passages: true, count: 10 }, defer()));

		//console.log(JSON.stringify(datadisc));



		if (datadisc["passages"] != null) {

			outputText = "The top most relevant passages from shift reports are below: <br><br>";
			if (datadisc["passages"][0] != null) {
				outputText += JSON.stringify(striptags(datadisc["passages"][0]["passage_text"], null, 2).replace(/\n/g, "<br>")) + "<br><br>";
			}
			if (datadisc["passages"][1] != null) {
				outputText += JSON.stringify(striptags(datadisc["passages"][1]["passage_text"], null, 2).replace(/\n/g, "<br>")) + "<br><br>";
			}
			if (datadisc["passages"][2] != null) {
				outputText += JSON.stringify(striptags(datadisc["passages"][2]["passage_text"], null, 2).replace(/\n/g, "<br>"));
			}
		}
		else if (datadisc["results"] != null) {
			outputText = "The top most relevant shift reports are below: <br><br>";
			if (datadisc["results"][0] != null) {
				outputText += JSON.stringify(striptags(datadisc["results"][0]["contentHtml"].substring(0, 1000), null, 2).replace(/\n/g, "<br>")) + ".....<br><a href=" + datadisc["results"][0]["sourceUrl"] + "><b>Click here for document</b></a><br><br>";
			}
			if (datadisc["results"][1] != null) {
				outputText += JSON.stringify(striptags(datadisc["results"][1]["contentHtml"].substring(0, 1000), null, 2).replace(/\n/g, "<br>")) + ".....<br><a href=" + datadisc["results"][0]["sourceUrl"] + "><b>Click here for document</b></a><br><br>";
			}
			if (datadisc["results"][2] != null) {
				outputText += JSON.stringify(striptags(datadisc["results"][2]["contentHtml"].substring(0, 1000), null, 2).replace(/\n/g, "<br>")) + ".....<br><a href=" + datadisc["results"][0]["sourceUrl"] + "><b>Click here for document</b></a><br><br>"
			}

		}
		//console.log(JSON.stringify(datadisc));

	}

	return outputText;
}


function executeQuerySync(sql) {



	var output = syncSql.mysql(
		{
			host: process.env.DB_HOST,
			user: process.env.DB_USER,
			password: process.env.DB_PWD,
			database: process.env.DB_NAME,
			port: '3306'
		},
		sql
	);

	return output;
}

/*
	Orchestration Layer Methods 
*/

function orchestrateBotResponseTextForSiteName(dbQueryResult, outputText, response, childCount) {

	console.log("orchestrateBotResponseTextForSiteName = >Length of rows =>" + dbQueryResult.length);
	//console.log ("Output =>" + outputText);
	if (dbQueryResult != null && dbQueryResult.length == 0) {
		outputText = "Sorry, <b>no</b> result can be found against given incident number.";
	}
	if (dbQueryResult != null && dbQueryResult.length >= 1) {

		outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].impact).s;
		outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].region).s;
		outputText = S(outputText).replaceAll('[site_name]', dbQueryResult[0].site_name).s;
		outputText = S(outputText).replaceAll('[status]', dbQueryResult[0].status).s;
		outputText = S(outputText).replaceAll('[assigned_to]', dbQueryResult[0].assigned_group).s;
		outputText = S(outputText).replaceAll('[incident_summary]', dbQueryResult[0].summary).s;
		outputText = S(outputText).replaceAll('[task_assignee_group]', dbQueryResult[0].task_assignee_group).s;
		outputText = S(outputText).replaceAll('[task_assignee]', dbQueryResult[0].task_assignee).s;
		console.log("Output after replace =>" + outputText);
		if (dbQueryResult[0].status.toLowerCase() == 'closed') {

			outputText += "<br/><b>Incident Event Start:</b> <i>" + dbQueryResult[0].incident_event_start_time + "</i> <br/> <b>Incident Event Closed:</b> <i>" + dbQueryResult[0].incident_event_end_time + "</i>.";
			outputText += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].resolution_category_tier_3 + "";
		}
		if (dbQueryResult[0].parent_incident_number == '' || dbQueryResult[0].parent_incident_number == null) { // incident is master incident
			response.context.cxt_is_master_incident = true;
			response.context.cxt_incident_number = dbQueryResult[0].incident_number;
			var child_incident_count = childCount;
			response.context.cxt_child_incident_count = child_incident_count;

			outputText += "<br/><br/> I also found that  <b>" + dbQueryResult[0].incident_number + "</b> is a <b>master</b> incident ";
			if (childCount > 0) {
				outputText += "and it has " + child_incident_count + " child incidents, if you like to see these incidents detail, reply with <b>yes</b>.";
			} else {
				response.context.cxt_incident_number = -1;
				outputText += "and it does not have any child incidents.<br/><br/> Is there anything i can help you with? I have information about incident, region, customer, transmission failure and shift reports. Please choose one.?";
			}
		} else {
			response.context.cxt_is_master_incident = false;
			response.context.cxt_parent_incident_number = dbQueryResult[0].parent_incident_number;
			outputText += "<br/><br/> I found that " + dbQueryResult[0].incident_number + " child of master incident " + dbQueryResult[0].parent_incident_number + ". if you like to see the detail of master incident, reply with <b>yes</b>.";
		}


		outputText = addFeedbackButton(outputText);

	}

	return outputText;
}

function showParentIncidentDetails(dbQueryResult, outputText, data) {
	var outputText_new = '';
	outputText_new = "Please see details below for Master incident " + dbQueryResult[0].incident_number + ".<br/><br/>";
	outputText_new += "This incident was logged for <b><i>[site_name]</i></b> in the <b><i>[region]</i></b>.<br/>The status is <b><i>[status]</i></b>, impact is set to <b><i>[impact]</i></b> and it has been assigned to the <b><i>[assigned_to]</i></b>.<br/>        <b>Incident Summary :</b> [incident_summary]<br/><b>Task Assignee group :</b> [task_assignee_group]<br><b>Task Assignee :</b> [task_assignee]";

	outputText_new = S(outputText_new).replaceAll('[impact]', dbQueryResult[0].impact).s;
	outputText_new = S(outputText_new).replaceAll('[region]', dbQueryResult[0].region).s;
	outputText_new = S(outputText_new).replaceAll('[site_name]', dbQueryResult[0].site_name).s;
	outputText_new = S(outputText_new).replaceAll('[status]', dbQueryResult[0].status).s;
	outputText_new = S(outputText_new).replaceAll('[assigned_to]', dbQueryResult[0].assigned_group).s;
	outputText_new = S(outputText_new).replaceAll('[incident_summary]', dbQueryResult[0].summary).s;
	outputText_new = S(outputText_new).replaceAll('[task_assignee_group]', dbQueryResult[0].task_assignee_group).s;
	outputText_new = S(outputText_new).replaceAll('[task_assignee]', dbQueryResult[0].task_assignee).s;

	if (dbQueryResult[0].status.toLowerCase() == 'closed') {
		outputText_new += "<br/><b>Incident Event Start:</b> <i>" + dbQueryResult[0].incident_event_start_time + "</i> <br/> <b>Incident Event Closed:</b> <i>" + dbQueryResult[0].incident_event_end_time + "</i>.";
		outputText_new += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].resolution_category_tier_3 + "";
	}


	//console.log("response.output.text[1]"+response.output.text[1]);
	outputText = outputText_new + "<br/>" + data.output.text[1];// += response.output.text[1];// += outputText_new;"<br/><br/>"+ data.output.text[1];
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function showChildIncidents(dbQueryResult, outputText, data, conversationId) {
	var outputText_new = '';
	var excelFileName = "childIncidentList_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	if (dbQueryResult.length > excelGenerationRecordCountLimit) {
		//outputText_new ="Please see details below for 10 child incidents only. <br/>";
		outputText_new += "Please see details for incidents in excel sheet.<br/>";
		outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
		buildExcelSheet(excelFileName, dbQueryResult, 4);
	} else {
		outputText_new = "Please see details below for <b>" + dbQueryResult.length + "</b> child incidents only. <br/>";

		outputText_new += "<table class='w-80'>";
		outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
		for (i = 0; i < dbQueryResult.length; i++) {

			if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				break;
			}
			outputText_new += "<tr><td>" + dbQueryResult[i].incident_number + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

		}
		outputText_new += "</table><br/>";
	}
	if (data.output.text[1] != null) {
		outputText = outputText_new + data.output.text[1];
	} else {
		outputText = outputText_new;
	}

	outputText = addFeedbackButton(outputText);

	return outputText;

}

function orchestrateBotResponseTextForIncident(dbQueryResult, outputText, response, childCount) {

	console.log("orchestrateBotResponseTextForIncident = >Length of rows =>" + dbQueryResult.length);
	//console.log ("Output =>" + outputText);
	if (dbQueryResult != null && dbQueryResult.length == 0) {
		outputText = "Sorry, no result can be found against given incident number.";
	}
	if (dbQueryResult != null && dbQueryResult.length >= 1) {

		outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].impact).s;
		outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].region).s;
		outputText = S(outputText).replaceAll('[site_name]', dbQueryResult[0].site_name).s;
		outputText = S(outputText).replaceAll('[status]', dbQueryResult[0].status).s;
		outputText = S(outputText).replaceAll('[assigned_to]', dbQueryResult[0].assigned_group).s;
		outputText = S(outputText).replaceAll('[incident_summary]', dbQueryResult[0].summary).s;
		outputText = S(outputText).replaceAll('[task_assignee_group]', dbQueryResult[0].task_assignee_group).s;
		outputText = S(outputText).replaceAll('[task_assignee]', dbQueryResult[0].task_assignee).s;
		console.log("Output after replace =>" + outputText);
		outputText += "<br/><i><b>Incident Event Start:</b> <i>" + dbQueryResult[0].incident_event_start_time;
		if (dbQueryResult[0].status.toLowerCase() == 'closed') {

			outputText += "<br/><b>Incident Event Closed:</b> <i>" + dbQueryResult[0].incident_event_end_time + "</i>.";
			outputText += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].resolution_category_tier_3 + "";
		}
		if (dbQueryResult[0].parent_incident_number == '' || dbQueryResult[0].parent_incident_number == null) { // incident is master incident
			response.context.cxt_is_master_incident = true;
			response.context.cxt_incident_number = dbQueryResult[0].incident_number;
			var child_incident_count = childCount;
			response.context.cxt_child_incident_count = child_incident_count;

			outputText += "<br/><br/> I also found that  <b>" + dbQueryResult[0].incident_number + "</b> is a <b>master</b> incident ";
			if (childCount > 0) {
				outputText += "and it has <b>" + child_incident_count + "</b> child incidents, if you like to see these incidents detail, reply with <b>yes</b>.";

			} else {
				response.context.cxt_incident_number = -1;
				outputText += "and it does not have any child incidents.<br/><br/> <b>Is there anything i can help you with? I have information about incident, region, customer, transmission failure and shift reports. Please choose one.</b>";

			}
		} else {
			response.context.cxt_is_master_incident = false;
			response.context.cxt_parent_incident_number = dbQueryResult[0].parent_incident_number;
			outputText += "<br/><br/> I found that " + dbQueryResult[0].incident_number + " child of master incident " + dbQueryResult[0].parent_incident_number + ". if you like to see the detail of master incident, reply with <b>yes</b>.";

		}

		outputText = addFeedbackButton(outputText);


	}

	return outputText;
}

function orchestrateBotResponseTextForRegion(dbQueryResult, outputText, regionName_2, data) {

	console.log("orchestrateBotResponseTextForRegion = >Length of rows =>" + dbQueryResult.length);
	var masterIncidentCount = 0;
	var childIncidentCount = 0;
	if (dbQueryResult != null) {

		var masterIncidentCountsql = "Select distinct(incident_number),count(*) as masterCount from incidents where region like '%" + regionName_2 + "%' and parent_incident_number is null and LOWER(status) != 'closed';";
		console.log("masterIncidentCountsql =>" + masterIncidentCountsql);
		var masterIncidentCountResult = executeQuerySync(masterIncidentCountsql);

		masterIncidentCount = masterIncidentCountResult.data.rows[0].masterCount;

		var childIncidentCountsql = "Select count(*) as childCount from incidents i inner join incidents i2 on (i.parent_incident_number = i2.incident_number) where i.region like '%" + regionName_2 + "%' and i.parent_incident_number is not null and LOWER(i.status) != 'closed' and LOWER(i2.status) != 'closed'";
		console.log("childIncidentCountsql =>" + childIncidentCountsql);
		var childIncidentCountResult = executeQuerySync(childIncidentCountsql);
		childIncidentCount = childIncidentCountResult.data.rows[0].childCount;

		var is_are = "is";
		if (childIncidentCount > 1) {
			is_are = "are";
		}
		outputText = data.output.text[0];
		/*if (data.output.text[1] != null) {
			outputText += data.output.text[1];
		}*/
		//data.context.cxt_region_name = dbQueryResult[0].region;
		outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + dbQueryResult[0].incidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[region_name]', "<b>" + dbQueryResult[0].region + "</b>").s;
		outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[is_are]', is_are).s;


	}

	outputText += "<br/><br/>Would you like to see details of master incident with linked child incidents or are you looking for an isolated fault? Please reply with master or fault."
	//outputText = addFeedbackButton(outputText);

	return outputText;
}

function updateSuggestedLocationsInMessage(messageText, regionCode) {

	var locationQuery = "SELECT location_name FROM `locations_lookup` where remedy_location_name like '%" + regionCode + "%' limit 10";
	console.log("Query for updating locations in message. =>" + locationQuery);
	var locationsResultSet = executeQuerySync(locationQuery);
	if (messageText == null) {
		messageText = '';
	}
	if (locationsResultSet != null && locationsResultSet.data.rows.length > 0) {
		messageText = "Type the location name. Common Locations are <br/>";
		for (i = 0; i < locationsResultSet.data.rows.length; i++) {
			messageText += locationsResultSet.data.rows[i].location_name;
			if (i < locationsResultSet.data.rows.length - 1)
				messageText += ",&nbsp;";
			if (i > 0 && i % 4 == 0) {
				messageText += "<br/>";
			}

		}


	}
	return messageText;
}

function showIncidentsForSiteName(dbQueryResult, outputText, data, conversationId) {
	var outputText_new;
	var excelFileName = "incidentListBasedOnSite_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	if (dbQueryResult.length == 0) {
		outputText_new = "Sorry <b>no</b> incident found against the given site name.<br/>";
		//outputText += updateSuggestedLocationsInMessage(outputText_new, data.context.cxt_region_name);
		if (data.output.text[0] != null) {
			outputText = outputText_new + data.output.text[0];
		} else {
			outputText = outputText_new;
		}
		outputText = addFeedbackButton(outputText);
		return outputText;
	}
	outputText_new = "There are total <b>" + dbQueryResult.length + "</b> incidents. ";
	if (dbQueryResult.length > excelGenerationRecordCountLimit) {
		//outputText_new +="Please see details below for 10 incidents only. <br/>";
		outputText_new += "Please see details for incidents in excel sheet.<br/>";
		outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
		buildExcelSheet(excelFileName, dbQueryResult, 4);
	} else {
		outputText_new += "Please see details. <br/>";

		outputText_new += "<table class='w-80'>";
		outputText_new += "<tr><th style=''>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
		for (i = 0; i < dbQueryResult.length; i++) {

			if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				break;
			}
			outputText_new += "<tr><td>" + dbQueryResult[i].incident_number + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

		}
		outputText_new += "</table><br/>";
	}
	if (data.output.text[0] != null) {
		outputText = outputText_new + data.output.text[0];
	} else {
		outputText = outputText_new;
	}
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function DisplyDetailsForMasterIncidents(dbQueryResult, outputText, data, conversationId) {
	var outputText_new = "";
	var excelFileName = "masterIncidentListBasedOnRegion_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	if (dbQueryResult.length == 0) {
		outputText_new = "There are no master incidents.<br/>";
	} else {

		if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
			//outputText_new +="Please see details below for 10 incidents only. <br/>";
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else {
			outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> master incidents.<br/>";
			outputText_new += "<table class='w-80'>";
			outputText_new += "<tr><th>INCIDENT NUMBER</th><th>STATUS</th><th>DESCRIPTION</th><th>REGION</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {
				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				outputText_new += "<tr><td>" + dbQueryResult[i].incident_number + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].region + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

			}
			outputText_new += "</table><br/>";
		}
	}

	if (data.output.text[0] != null) {
		outputText = outputText_new + data.output.text[0];
	} else {
		outputText = outputText_new;
	}
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function showMasterIncidentsForRegion(dbQueryResult, outputText, data, conversationId) {
	var outputText_new = "";
	var excelFileName = "masterIncidentListBasedOnRegion_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	if (dbQueryResult.length == 0) {
		outputText_new = "There are <b>no</b> master incidents that have child associations.<br/>";
	} else {

		if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
			//outputText_new +="Please see details below for 10 incidents only. <br/>";
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else {
			outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> master incidents that have child association. <br/>";
			outputText_new += "<table class='w-80'>";
			outputText_new += "<tr><th>Child Count</th><th>PARENT INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {
				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				outputText_new += "<tr><td>" + dbQueryResult[i].count + "</td><td>" + dbQueryResult[i].parent_incident_number + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

			}
			outputText_new += "</table><br/>";
		}
	}

	if (data.output.text[0] != null) {
		outputText = outputText_new + data.output.text[0];
	} else {
		outputText = outputText_new;
	}
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function showIncidentsForRegionBasedOnLocation(dbQueryResult, outputText, data, conversationId) {
	var outputText_new = "";
	var excelFileName = "incidentListInRegionBasedOnLocation_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	if (dbQueryResult.length != 0) {
		outputText_new = "There are total <b>" + dbQueryResult.length + "</b> incidents. ";
	} else {
		outputText_new = "No incident data available in remedy for location " + data.context.cxt_location_name_region_flow + ". <br/><br/>";

	}
	if (dbQueryResult.length > excelGenerationRecordCountLimit) {
		outputText_new += "Please see details for incidents in excel sheet.<br/>";
		outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
		buildExcelSheet(excelFileName, dbQueryResult, 4);
	} else if (dbQueryResult.length > 0) {
		outputText_new += "Please see details below for <b>" + dbQueryResult.length + "</b> incidents only. <br/>";
		outputText_new += "<table class='w-80'>";
		outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
		for (i = 0; i < dbQueryResult.length; i++) {

			if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				break;
			}
			outputText_new += "<tr><td>" + dbQueryResult[i].incident_number + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

		}
		outputText_new += "</table><br/>";
	}
	if (data.output.text[0] != null) {
		outputText = outputText_new + data.output.text[0];
	} else {
		outputText = outputText_new;
	}
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function showIncidentsForTransmissionFailureOnLocation(dbQueryResult, outputText, data, conversationId) {
	var outputText_new = '';
	var excelFileName = "incidentListForTransmissionFailureBasedOnLocation_" + conversationId + "_" + new Date().getTime() + ".xlsx";
	console.log("showIncidentsForTransmissionFailureOnLocation=>resultCount=>" + dbQueryResult.length);
	if (dbQueryResult.length == 0) {
		outputText_new += "There are no master open faults for type <b>" + data.context.cxt_tx_name + "</b> in the selected area <b>" + data.context.cxt_location_name_trx_flow + "</b>. ";

	}
	if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
		outputText_new += "Please see details for incidents in excel sheet.<br/>";
		outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
		buildExcelSheet(excelFileName, dbQueryResult, 4);

	} else if (dbQueryResult.length > 0) {
		outputText_new += "There are total <b>" + dbQueryResult.length + "</b> master incidents for transmission failure type " + data.context.cxt_tx_name + ". ";
		outputText_new += "<table class='w-80'>";
		outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
		for (i = 0; i < dbQueryResult.length; i++) {

			outputText_new += "<tr><td>" + dbQueryResult[i].incident_number + "</td><td>" + dbQueryResult[i].summary + "</td><td>" + dbQueryResult[i].status + "</td><td>" + dbQueryResult[i].site_name + "</td></tr>";

		}
		outputText_new += "</table><br/>";
	}

	console.log("outputText_new=>" + data.output.text);
	if (data.output.text[1] != null) {
		outputText = outputText_new + "<br/>" + data.output.text[1];
	} else {
		outputText = outputText_new;
	}
	outputText = addFeedbackButton(outputText);
	return outputText;
}

function orchestrateBotResponseTextForCustomer(dbQueryResult, outputText, customerName, data) {

	console.log("orchestrateBotResponseTextForCustomer = >Length of rows =>" + dbQueryResult.length);
	if (dbQueryResult != null) {
		outputText = S(outputText).replaceAll('[no_of_customers]', "<b>" + dbQueryResult.length + "</b>").s;
		data.context.cxt_matched_customer_count = dbQueryResult.length;
	}

	return outputText;
}


function orchestrateBotResponseTextForTransmissionFailures(dbQueryResult, outputText, data) {

	console.log("orchestrateBotResponseTextForTransmissionFailures = >Length of rows =>" + dbQueryResult.length);
	var masterIncidentCount = 0;
	var childIncidentCount = 0;
	var outputText_new = '';
	if (dbQueryResult != null) {
		data.context.cxt_tx_found_incident_count = dbQueryResult[0].incidentCount;
		var cause_tier_1 = data.context.cxt_tx_name;
		var masterIncidentCountsql = "Select count(*) as masterCount from incidents where cause_tier_1 like '" + cause_tier_1 + "' and parent_incident_number is null and LOWER(status) != 'closed';";
		console.log("masterIncidentCountsql =>" + masterIncidentCountsql);
		var masterIncidentCountResult = executeQuerySync(masterIncidentCountsql);

		masterIncidentCount = masterIncidentCountResult.data.rows[0].masterCount;

		//var childIncidentCountsql = "Select count(*) as childCount from incidents where cause_tier_1 like '" + cause_tier_1 + "' and parent_incident_number is not null and LOWER(status) != 'closed'";
		var childIncidentCountsql = "Select count(*) as childCount from incidents i inner join incidents i2 on (i.parent_incident_number = i2.incident_number) where i.cause_tier_1 like '" + cause_tier_1 + "' and i2.cause_tier_1 like '" + cause_tier_1 + "' and i.parent_incident_number is not null and LOWER(i.status) != 'closed' and LOWER(i2.status) != 'closed'";
		console.log("childIncidentCountsql =>" + childIncidentCountsql);
		var childIncidentCountResult = executeQuerySync(childIncidentCountsql);
		childIncidentCount = childIncidentCountResult.data.rows[0].childCount;

		var is_are = "is";
		if (childIncidentCount > 1) {
			is_are = "are";
		}
		outputText = data.output.text[0];
		if (data.output.text[1] != null) {
			outputText += "<br/>" + data.output.text[1];
		}
		data.context.cxt_region_name = dbQueryResult[0].region;
		outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + dbQueryResult[0].incidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[failure_type_name]', "<b>" + cause_tier_1 + "</b>").s;
		outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[is_are]', is_are).s;
		if (dbQueryResult[0].incidentCount > 0) {
			outputText_new = "<br/>Do you want to further drill down the search? reply with <b>yes or no</b>.";
		} else {
			outputText_new = "<br/><b>No</b> incidents found against the given domain. If you want to search anything else reply with <b>yes</b>.";
		}


	}
	// this condition will handle the use case when in flow of intent 4 some one types again transmission failure domain when ask for yes or no.
	var pos = outputText.indexOf('exit');
	console.log("pos=>" + pos);
	if (pos > 0) {
		outputText = outputText;
	} else {
		if (outputText_new != '')
			outputText += outputText_new;
	}
	//outputText = addFeedbackButton(outputText);
	return outputText;
}


function orchestrateBotResponseTextForShiftReports(dbQueryResult) {

	var responseText = "Yes, sure, this is a " + dbQueryResult[0].impact + " issue in " + dbQueryResult[0].region + " region for site " + dbQueryResult[0].site_name + ". The status of this incident is " + dbQueryResult[0].status + " and it has been assigned to " + dbQueryResult[0].task_assigned + ".";

	return responseText;
}

function buildExcelSheet(excelSheetName, dbQueryResult, noOfColumns) {

	// Create a new workbook file in current working-path 
	var workbook = excelbuilder.createWorkbook('./', excelSheetName)

	// Create a new worksheet with 10 columns and 12 rows 
	var numberOfRows = dbQueryResult.length;
	var sheet1 = workbook.createSheet('data', noOfColumns, Number(numberOfRows) + Number(1));

	// Fill some data 
	sheet1.set(1, 1, 'Incident Number');
	sheet1.set(2, 1, 'Description');
	sheet1.set(3, 1, 'Status');
	sheet1.set(4, 1, 'Site Name');
	var j = 0;
	var numberOfRowsNew = Number(numberOfRows) + Number(2);

	for (var i = 2; i < numberOfRowsNew; i++) {
		//sheet1.set(col, row, data);
		//console.log(i);
		sheet1.set(1, i, dbQueryResult[j].incident_number);
		sheet1.set(2, i, dbQueryResult[j].summary);
		sheet1.set(3, i, dbQueryResult[j].status);
		sheet1.set(4, i, dbQueryResult[j].site_name);
		if (j == numberOfRows) {
			break;
		} else {
			j++;
		}
	}

	// Save it 
	workbook.save(function (ok) {
		if (!ok)
			workbook.cancel();
		else
			console.log('congratulations, your workbook created');
	});




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
	if (feedbackReason && all_output) {
		//console.log(all_output);
		var feedback_value = -1; // -1 is for thumbs down
		recordFeedback(all_output,feedbackReason,feedback_value);
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
		recordFeedback(all_output,null,feedback_value);
	}
})

function addFeedbackButton(outputText){
	outputText +="&nbsp;&nbsp;<img src='img/thumbsup-blue.png' class='feedback-img' title='good' onClick='openWindow(1);' />&nbsp;&nbsp;<img src='img/thumbsdown-red.png' class='feedback-img' title='bad' onClick='LogThumbsDown();' /><br/>";
	return outputText;
}

function recordFeedback(all_output,feedbackReason,feedback_value) {
	console.log("record feedback =>"+JSON.stringify(all_output));
	var input_text = all_output.input.text;
	if (input_text) {
		input_text = input_text;
	} else {
		input_text = "";
	}

	var output_text = striptags(outputText);

	if (outputText != null) {

		lastOutputText = striptags(outputText);
	} else {
		lastOutputText = striptags(lastOutputText);
	}
	

	var intents = all_output.intents
	if (intents[0]) {
		var intent = intents[0];
		intents = intent.intent;
	} else {
		intents = "";
	}

	var entities = all_output.entities
	if (entities[0]) {
		var entity = entities[0];
		entities = entity.entity;
	} else {
		entities = "";
	}
	var feeds = feedback_value;
	if (all_output.context.cxt_user_full_name != null) {
		userFullName = all_output.context.cxt_user_full_name;
	}
	if (intent != null) {
		lastUsedIntent = intent;
	}
	if (entity != null){
		lastUsedEntity = entity;
	}
	var feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, feedback,username,conversationId,feedback_comment) VALUES ('" + inputText + "', '" + lastOutputText + "', '" + lastUsedIntent + "', '" + lastUsedEntity + "', '" + feeds + "','" + userFullName + "','"+all_output.context.conversation_id+"','"+feedbackReason+"');";
	//console.log("query insert feedback =>" + feedback_sql);
	var output = executeQuerySync(feedback_sql);
	if (output.success) {
		console.log("Feedback Inserted into database");
	}
}

function recordResponseTime(response) {
	console.log("recordResponseTime");
	var intent = null;
	var entity = null;
	var conversationId = null;
	var fullName = null;
	if (response != null) {
		console.log(response);
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
	var responseText = null;
	if (response != null) {

		if (!response.output) {
			response.output = {};
		} else {
			//return response;
		}
	//	console.log("response =>" + JSON.stringify(response));
	console.log(outputText);
		if (outputText != null) {
			
			response.output.text = outputText;
			lastOutputText = outputText;
			recordResponseTime(response); // record time for every conversation message to get time of chat for one intent.
		}
	}
	//outputText = null;
	return response;
}

module.exports = app;
