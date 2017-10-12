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
var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as parent_incident_number,inc.SPE_FLD_ALARMEVENTSTARTTIME as incident_event_start_time,"+
									"inc.SPE_FLD_ALARMEVENTENDTIME as incident_event_end_time,inc.ACTUAL_START_DATE as task_actual_start_date, inc.ACTUAL_END_DATE as task_actual_end_date,"+
									"inc.SPE_FLD_ACTUALIMPACT as impact,inc.REGION,inc.HPD_CI as site_name,inc.DESCRIPTION as summary,decode(inc.status,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.status) as INC_STATUS,inc.ASSIGNED_GROUP as assigned_group,"+
									"inc.ASSIGNEE,inc.ASSIGNEE_GROUP as task_assignee_group,inc.ASSIGNEE_ID as task_assignee,inc.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2"+
									"inc.RESOLUTION_CATEGORY_TIER_3 as resolution_category_tier_3,inc.GENERIC_CATEGORIZATION_TIER_1 as cause_tier_1,inc.GENERIC_CATEGORIZATION_TIER_2 as cause_tier_2 ";

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

// Create the service wrapper
var conversation = new Conversation({
	url: 'https://gateway.watsonplatform.net/conversation/api',
	version_date: '2016-10-21',
	version: 'v1'
});

var discovery = new DiscoveryV1({ username:process.env.DISCOVERY_SERVICE_USERNAME, password: process.env.DISCOVERY_SERVICE_PASSWORD, version_date: process.env.DISCOVERY_SERVICE_VERSION_DATE })

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


				// handle context variable case here
				// show incident details intent 1 :: showing master of child.
				//try {
				//	fiber(function () {
				/*console.log("Querying vodacom db for testing connection");
				var sql = "SELECT * FROM  tellabs_ods.ebu_vlan_status_v WHERE ROWNUM < 10";
				var connection = getOracleDBConnection(oracleConnectionString);
				var result = getOracleQueryResult(connection, sql);
				doRelease(connection);
				console.log("resultRows=>" + JSON.stringify(result.rows));*/
				/*console.log("Testing Oracle Connection");
				var sql = "SELECT * FROM  incidents WHERE ROWNUM < 10";
				var connection = getOracleDBConnection(oracleConnectionString,sync);
				var result = getOracleQueryResult(connection, sql,sync);
				
				//doRelease(connection);
				console.log("resultRows=>" + JSON.stringify(result.rows));*/



				if (data != null && data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_incident_number != null && data.context.cxt_incident_number != -1 && data.context.cxt_is_master_incident != null && data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>" + data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>" + data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>" + data.context.cxt_show_anything_else_msg);
					var childsql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where ORIGINAL_INCIDENT_NUMBER = '" + data.context.cxt_incident_number + "';";
					console.log("query from context variable =>" + childsql);
					var childoutput = executeQuerySync(childsql);
					outputText = showChildIncidents(childoutput.data.rows, outputText, data, conversationId);
					data.context.cxt_show_incident_details = false;
					data.context.cxt_show_anything_else_msg = true;

				}
				//console.log("i am here 2");
				// show incident details intent 1 :: showing child of master
				if (data != null && data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_parent_incident_number != null && data.context.cxt_parent_incident_number != -1 && data.context.cxt_is_master_incident != null && !data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>"+ data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>"+ data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>"+ data.context.cxt_show_anything_else_msg);

					var childsql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where inc.incident_number = '" + data.context.cxt_parent_incident_number + "';";
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

				if (data != null && data.context.cxt_region_show_master_incident) {

					console.log("data.context.cxt_region_name =>" + data.context.cxt_region_name);
					var regionLookupQuery = "Select * from region_lookup where (full_name like '" + data.context.cxt_region_name + "' OR abbreviation like '" + data.context.cxt_region_name + "')";

					console.log("region lookup query for customer intent. =>" + regionLookupQuery);
					var lookupResult = executeQuerySync(regionLookupQuery);
					if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
						customerRegion = lookupResult.data.rows[0].full_name;
					}
					var childsql = "Select count(inc.incident_number) as count ,inc_2.status,inc.parent_incident_number,inc_2.site_name,inc_2.summary,inc_2.region from "+incidentTableName+" inner join "+incidentTableName_2+" on (inc.parent_incident_number = inc_2.incident_number) where inc.region like '%" + customerRegion + "%' and inc.parent_incident_number is not null and inc.status not in (5,6) and inc_2.status not in (5,6) group by i.ORIGINAL_INCIDENT_NUMBER	order by count desc";
					console.log("query to get Master Incident from context variable =>" + childsql);
					var masterIncidentsDetailsResult = executeQuerySync(childsql);
					console.log(masterIncidentsDetailsResult.data.rows.length);
					// if no master found with child association list all masters that are found for the region.
					if (masterIncidentsDetailsResult.data.rows.length == 0) {
						childsql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where inc.region like '%" + customerRegion + "%' and inc.parent_incident_number is null and inc.status not in (5,6)";
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
				if (data != null && data.context.cxt_region_show_isolated_fault && data.context.cxt_site_name_region_flow == null && !data.context.cxt_region_flow_search_for_location) {
					// update message for entering site with actual sites in region of query.
					if (data.context.cxt_region_full_name != null) {
						var listOfSitesQuery = "SELECT distinct HPD_CI FROM "+incidentTableName+" WHERE region like '%" + data.context.cxt_region_full_name + "%' WHERE ROWNUM < 11;";
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
				if (data != null && data.context.cxt_region_show_isolated_fault && data.context.cxt_site_name_region_flow != null) {


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
							var incidentSql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where HPD_CI like '%" + data.context.cxt_site_name_region_flow + "%'";// and Lower(status) != 'closed' ;";
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
				if (data != null && data.context.cxt_location_name_region_flow != null) {
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
						var incidentSql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where HPD_CI in " + inOperator + " and status not in (5,6);";
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
				if (data != null && data.context.cxt_location_name_trx_flow != null) {

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
						var incidentSql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where inc.HPD_CI in " + inOperator + " and inc.GENERIC_CATEGORIZATION_TIER_1	like '" + data.context.cxt_tx_name + "' and inc.status not in (5,6) and (ORIGINAL_INCIDENT_NUMBER is null OR ORIGINAL_INCIDENT_NUMBER = '')";
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
				if (data != null && data.context.cxt_customer_flow_node_detail_query_executed) {
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
				if (data != null && data.context.cxt_customer_flow_found != null) {



					// summary flow triggered
					// place code here
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

					var sql = "Select MPLSVPN_NAME,IFNR,IFALIAS,IFACCURSTRING,NID,NODE_NM from tellabs_ods.ebu_vlan_status_v ";
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
						
						var connection = getOracleDBConnection(oracleConnectionString);
						var output = getOracleQueryResult(connection, sql);
						doRelease(connection);
						//var output = executeQuerySync(sql);

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
							var connection = getOracleDBConnection(oracleConnectionString);
							var output = getOracleQueryResult(connection, sql);
							doRelease(connection);
							//output = executeQuerySync(sql);

							//outputText = "Please see summary of the end point for " + data.context.cxt_show_customer_selected_name + "<br/>";
							//outputText += output.data.rows[0].MPLSVPN_NAME + "<br/>" + output.data.rows[0].IFNR + "<br/>" + output.data.rows[0].IFALIAS + "<br/>"
							//	+ output.data.rows[0].IFACCURSTRING + "<br/>" + output.data.rows[0].NID + "<br/>" + output.data.rows[0].NODE_NM + "<br/><br/>";
							var nodeId = output.data.rows[0].NID;

							var nodeSql = "select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where HPD_CI like '%" + nodeId + "%'";
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







				if (data != null && data.context.cxt_user_logged_in) {

					console.log("user is logged in now checking intent");
					/* SITES intent and context variable code */
					outputText = handleSitesIntent(data, inputText, outputText);

					/*Incident Intent Handling.*/
					outputText = handleIncidentIntent(data, inputText, outputText, incidentFlow);


					/*Region Intent Handling.*/
					outputText = handleRegionIntent(data, inputText, outputText);



					/*Corporate Customer Intent handling.*/
					outputText = handleCustomerIntent(data, inputText, outputText, incidentFlow,sync);


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

				if (data != null && !data.context.cxt_user_logged_in && data.context.cxt_verify_user) {
					console.log("verifying user credentials");

					if (data.context.cxt_user_email != null && data.context.cxt_user_password != null) {
						var loginQuery = "Select first_name,last_name from bot_users where email = '" + data.context.cxt_user_email + "' and password = '" + data.context.cxt_user_password + "';";
						var loginOutPut = executeQuerySync(loginQuery);
						if (loginOutPut.data.rows.length != 0) {
							console.log("credentials verified");
							data.context.cxt_user_logged_in = true;
							data.context.cxt_user_full_name = loginOutPut.data.rows[0].first_name + " " + loginOutPut.data.rows[0].last_name;
							userFullName = data.context.cxt_user_full_name;
							//outputText = data.output.text[0];//"Your credentials are verified. You are now logged in. ";
							console.log(data);
						} else {
							console.log("credentials not verified");
							//if ()
							outputText = data.output.text[0];
							if (data.output.text[1] != null) {
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
				if (data) {
					all_output = data;
				} else {
					outputText = "Conversation service is not responding in timely manner. Sorry for inconvenience.";
				}
				return res.json(updateMessage(payload, data));
			});
		} catch (err) {
			//TODO Handle error
			console.log("error=>" + JSON.stringify(err.stack));
		}


	});


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
	if (feedbackReason && all_output) {
		//console.log(all_output);
		var feedback_value = -1; // -1 is for thumbs down
		recordFeedback(all_output, feedbackReason, feedback_value);
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



function recordFeedback(all_output, feedbackReason, feedback_value) {
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
	} else {
		lastOutputText = striptags(lastOutputText);
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
	var feedback_sql = "INSERT INTO feedback (input_text, output_text, intents, entities, feedback,username,conversationId,feedback_comment) VALUES ('" + inputText + "', '" + lastOutputText + "', '" + lastUsedIntent + "', '" + lastUsedEntity + "', '" + feeds + "','" + userFullName + "','" + all_output.context.conversation_id + "'," + feedbackReason + ");";
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
		//console.log("response =>" + JSON.stringify(response));
		//console.log("outputText=>"+outputText);
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
