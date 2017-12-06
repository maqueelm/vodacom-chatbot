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
//console.log("correct Incident Number =>"+correctIncidentNumberFormat("INC000003341513"));
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

				//var incident_query = "select ASSIGNEE,ASSIGNED_GROUP from "+incidentTableName+" where incident_number = 'INC000008400003' and ROWNUM = 1";
				//console.log(incident_query);
				//var connection = getOracleDBConnectionRemedy(sync);
				//console.log(connection);
				//var incidentoutput = getOracleQueryResult(connection, incident_query, sync);
				//console.log(JSON.stringify(incidentoutput));

				if (data != null && data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_incident_number != null && data.context.cxt_incident_number != -1 && data.context.cxt_is_master_incident != null && data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>" + data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>" + data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>" + data.context.cxt_show_anything_else_msg);
					var childsql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.ORIGINAL_INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(data.context.cxt_incident_number) + "'";

					//"Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where ORIGINAL_INCIDENT_NUMBER = '" + data.context.cxt_incident_number + "'";

					console.log("query from context variable =>" + childsql);
					//var childoutput = executeQuerySync(childsql);
					var connection = getOracleDBConnectionRemedy(sync);
					var childoutput = getOracleQueryResult(connection, childsql, sync);
					doRelease(connection);
					outputText = showChildIncidents(childoutput.rows, outputText, data, conversationId);
					data.context.cxt_show_incident_details = false;
					data.context.cxt_show_anything_else_msg = true;

				}
				//console.log("i am here 2");
				// show incident details intent 1 :: showing child of master
				if (data != null && data.context.cxt_show_incident_details != null && data.context.cxt_show_incident_details == true && data.context.cxt_parent_incident_number != null && data.context.cxt_parent_incident_number != -1 && data.context.cxt_is_master_incident != null && !data.context.cxt_is_master_incident) {

					//console.log("data.context.cxt_parent_incident_number =>"+ data.context.cxt_incident_number);
					//console.log("data.context.cxt_show_incident_details =>"+ data.context.cxt_show_incident_details);
					//console.log("data.context.cxt_show_anything_else_msg =>"+ data.context.cxt_show_anything_else_msg);

					//var childsql = "Select "+incidentTableJoinTaskTable+" from "+incidentTableName+" where inc.INCIDENT_NUMBER = '" + data.context.cxt_parent_incident_number + "'";
					var childsql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(data.context.cxt_parent_incident_number) + "'";
					console.log("query from context variable =>" + childsql);
					//var childoutput = executeQuerySync(childsql);
					var connection = getOracleDBConnectionRemedy(sync);
					var childoutput = getOracleQueryResult(connection, childsql, sync);
					doRelease(connection);
					outputText = showParentIncidentDetails(childoutput.rows, outputText, data);
					data.context.cxt_show_anything_else_msg = true;
					data.context.cxt_show_incident_details = false;
					data.context.cxt_parent_incident_number = -1;
					data.context.cxt_parent_incident_number = -1;


				}
				//	console.log("i am here 3");
				// intent 2 :: Master Incident

				if (data != null && data.context.cxt_region_show_master_incident) {

					console.log("data.context.cxt_region_name =>" + data.context.cxt_region_name);
					var regionLookupQuery = "Select * from region_lookup where (LOWER(full_name) = '" + data.context.cxt_region_name.toLowerCase() + "' OR LOWER(abbreviation) = '" + data.context.cxt_region_name.toLowerCase() + "')";

					console.log("region lookup query for customer intent. =>" + regionLookupQuery);
					var lookupResult = executeQuerySync(regionLookupQuery);
					if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
						customerRegion = lookupResult.data.rows[0].full_name;
					} else {
						customerRegion = data.context.cxt_region_name;
					}



					console.log("data.context.cxt_child_incident_count_for_region=>" + data.context.cxt_child_incident_count_for_region);
					// if no master found with child association list all masters that are found for the region.
					if (data.context.cxt_child_incident_count_for_region == 0) {
						var childsql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where LOWER(inc.region) = '" + customerRegion.toLowerCase() + "' and inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)";
						console.log("query to get Master Incident from context variable =>" + childsql);
						//masterIncidentsDetailsResult = executeQuerySync(childsql);
						var connection = getOracleDBConnectionRemedy(sync);
						var masterIncidentsDetailsResult = getOracleQueryResult(connection, childsql, sync);
						doRelease(connection);
						outputText = DisplyDetailsForMasterIncidents(masterIncidentsDetailsResult.rows, outputText, data, conversationId);

					} else {
						//var childsql = "Select count(inc.INCIDENT_NUMBER) as COUNT ,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER AS PARENT_INCIDENT_NUMBER,inc.HPD_CI AS SITE_NAME,inc.DESCRIPTION AS SUMMARY,inc.REGION from " + incidentTableName + " inner join " + incidentTableName_2 + " on ( inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) AND LOWER(inc.REGION) = '" + customerRegion+ "' group by (inc.STATUS,inc.ORIGINAL_INCIDENT_NUMBER,inc.HPD_CI,inc.DESCRIPTION,inc.REGION,inc.INCIDENT_NUMBER) order by COUNT desc";
						var masterSql = "Select distinct inc.INCIDENT_NUMBER,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,inc.ORIGINAL_INCIDENT_NUMBER AS PARENT_INCIDENT_NUMBER,inc.HPD_CI AS SITE_NAME,inc.DESCRIPTION AS SUMMARY,inc.REGION from " + incidentTableName + " inner join " + incidentTableName_2 + " on ( inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) AND LOWER(inc.REGION) = '" + customerRegion.toLowerCase() + "'";
						console.log("query to get Master Incident from with child associations context variable =>" + masterSql);
						//var masterIncidentsDetailsResult = executeQuerySync(childsql);
						var connection = getOracleDBConnectionRemedy(sync);
						var masterIncidentsDetailsResult = getOracleQueryResult(connection, masterSql, sync);
						doRelease(connection);
						console.log("masterIncidentsDetailsResult.length=>" + masterIncidentsDetailsResult.rows.length);
						outputText = showMasterIncidentsForRegion(masterIncidentsDetailsResult.rows, outputText, data, conversationId);
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
						var listOfSitesQuery = "SELECT distinct HPD_CI as SITE_NAME FROM " + incidentTableName + " WHERE LOWER(region) = '" + data.context.cxt_region_full_name.toLowerCase() + "' AND ROWNUM < 11";
						console.log("listOfSitesQuery =>" + listOfSitesQuery);
						//var listOfSitesOutput = executeQuerySync(listOfSitesQuery);
						var connection = getOracleDBConnectionRemedy(sync);
						var listOfSitesOutput = getOracleQueryResult(connection, listOfSitesQuery, sync);
						doRelease(connection);
						if (listOfSitesOutput != null && listOfSitesOutput.rows.length > 0) {
							outputText = "Do you know the site or node name. Common names in <b>" + data.context.cxt_region_full_name + "</b> are <br/>";
							for (i = 0; i < listOfSitesOutput.rows.length; i++) {
								if (i > 0 && i % 4 == 0) {
									outputText += "<br/>";
								}
								outputText += listOfSitesOutput.rows[i].SITE_NAME;
								if (i < listOfSitesOutput.rows.length - 1)
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
					//var sitenameSql = "SELECT distinct ci_name FROM `locations_lookup` WHERE `ci_name` LIKE '%" + siteName + "%';";
					var sitenameSql = "SELECT DISTINCT REPO_LOCATION_NAME AS LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE LOWER(CI_NAME) = '" + siteName.toLowerCase() + "'";
					/*var sitenameSql = "SELECT l.object_key as location_key, l.name as location_name, l.atoll_id, l.remedy_name as remedy_location_name, n.OBJECT_CLASS, n.OBJECT_KEY, n.NAME CI_NAME, n.NODE_STATUS, n.PARENT_NODE, n.REMEDY_STATUS, n.REMEDY_ID" +
						" FROM name_repo.node_v n JOIN name_repo.site_v l ON n.site = l.object_key WHERE n.NODE_STATUS = 'In Service' and n.NAME like '%" + siteName + "%' ";*/
					console.log("Query for matching site name oracle database table. =>" + sitenameSql);
					// var sitenameOutput = executeQuerySync(sitenameSql);

					var connection = getOracleDBConnection(sync);
					var sitenameOutput = getOracleQueryResult(connection, sitenameSql, sync);
					doRelease(connection);

					if (sitenameOutput != null && sitenameOutput.rows != null && sitenameOutput.rows.length >= 1) {
						// site name found
						data.context.cxt_site_name_region_flow_found = true;
						if (data.context.cxt_site_name_region_show_incident_detail) {

							console.log("incidents found for site name " + data.context.cxt_site_name_region_flow);
							var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.status in (0,1,2,3) and LOWER(HPD_CI) = '" + data.context.cxt_site_name_region_flow.toLowerCase() + "'";// and Lower(status) != 'closed' ;";
							console.log("query from context variable =>" + incidentSql);
							//var incidentOutput = executeQuerySync(incidentSql);
							var connection = getOracleDBConnectionRemedy(sync);
							var listOfSitesOutput = getOracleQueryResult(connection, incidentSql, sync);
							doRelease(connection);
							if (listOfSitesOutput != null && listOfSitesOutput.rows != null) {
								outputText = showIncidentsForSiteName(listOfSitesOutput.rows, outputText, data, conversationId); // this method is used for displaying incident information
							} else {
								listOfSitesOutput = {};
								outputText = showIncidentsForSiteName(listOfSitesOutput, outputText, data, conversationId);
							}
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
					var locationSql = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(REPO_LOCATION_NAME) = '" + data.context.cxt_location_name_region_flow.toLowerCase() + "'";
					/*var locationSql = "SELECT l.object_key as location_key, l.name as location_name, l.atoll_id, l.remedy_name as remedy_location_name, n.OBJECT_CLASS, n.OBJECT_KEY, n.NAME as CI_NAME, n.NODE_STATUS, n.PARENT_NODE, n.REMEDY_STATUS, n.REMEDY_ID" +
						" FROM name_repo.node_v n JOIN name_repo.site_v l ON n.site = l.object_key WHERE ROWNUM < 11 and n.NODE_STATUS = 'In Service' and l.remedy_name like '%" + data.context.cxt_location_name_region_flow + "%' ";*/
					console.log("location query from context variable =>" + locationSql);
					var connection = getOracleDBConnection(sync);
					var locationOutput = getOracleQueryResult(connection, locationSql, sync);
					doRelease(connection);
					//var locationOutput = executeQuerySync(locationSql);
					var inOperator = "(";
					console.log("site names on location =>" + locationOutput.rows.length);
					if (locationOutput.rows.length > 0) {
						for (i = 0; i < locationOutput.rows.length; i++) {

							inOperator += "'" + locationOutput.rows[i].CI_NAME + "'";

							if (i < locationOutput.rows.length - 1) {
								inOperator += ",";
							}


						}
						inOperator += ")";
						console.log(inOperator);
						var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where HPD_CI in " + inOperator + " and status in (0,1,2,3)";
						console.log(incidentSql);
						//var incidentOutput = executeQuerySync(incidentSql);
						var connection = getOracleDBConnectionRemedy(sync);
						var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
						doRelease(connection);
						data.context.cxt_region_flow_search_for_location = false;
						data.context.cxt_region_full_name = null;
						outputText = showIncidentsForRegionBasedOnLocation(incidentOutput.rows, outputText, data, conversationId);
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
					var locationSql = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(REPO_LOCATION_NAME) = '" + data.context.cxt_location_name_trx_flow.toLowerCase() + "'";
					//var locationSql = "SELECT distinct CI_NAME FROM locations_lookup l inner join tech_location_mapping lm ON l.object_class = lm.core_ecs WHERE l.remedy_location_name LIKE '%" + data.context.cxt_location_name_trx_flow + "%' AND lower(lm.tech_type) like '%" + data.context.cxt_tx_name.toLowerCase() + "%'";
					//var locationSql = "SELECT l.object_key as location_key, l.name as location_name, l.atoll_id, l.remedy_name as remedy_location_name, n.OBJECT_CLASS, n.OBJECT_KEY, n.NAME as CI_NAME, n.NODE_STATUS, n.PARENT_NODE, n.REMEDY_STATUS, n.REMEDY_ID"+
					//" FROM name_repo.node_v n JOIN name_repo.site_v l ON n.site = l.object_key WHERE ROWNUM < 11 and n.NODE_STATUS = 'In Service' and l.remedy_name like '%" + data.context.cxt_location_name_trx_flow + "%' ";

					console.log("location query from context variable for trx =>" + locationSql);
					//var locationOutput = executeQuerySync(locationSql);
					var connection = getOracleDBConnection(sync);
					var locationOutput = getOracleQueryResult(connection, locationSql, sync);

					var inOperator = "(";
					if (locationOutput != null && locationOutput.rows.length > 0) {
						console.log("locationOutput.rows.length =>" + locationOutput.rows.length);

						data.context.cxt_location_name_trx_flow_found = true;
						for (i = 0; i < locationOutput.rows.length; i++) {

							inOperator += "'" + locationOutput.rows[i].CI_NAME + "'";

							if (i < locationOutput.rows.length - 1) {
								inOperator += ",";
							}


						}
						inOperator += ")";
						var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.HPD_CI in " + inOperator + " and INC.INCIDENT_ASSOCIATION_TYPE = 0 AND inc.status in (0,1,2,3) AND LOWER(inc.GENERIC_CATEGORIZATION_TIER_2) = '" + data.context.cxt_tx_name.toLowerCase() + "' ";
						console.log("incident sql =>" + incidentSql);
						//var incidentOutput = executeQuerySync(incidentSql);
						var connection = getOracleDBConnectionRemedy(sync);
						var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
						doRelease(connection);

						outputText = showIncidentsForTransmissionFailureOnLocation(incidentOutput.rows, outputText, data, conversationId);
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
				if (data != null && data.context.cxt_matched_customer_list != null && data.context.cxt_customer_query == null) {

					console.log("data.context.cxt_customer_flow_found=>" + data.context.cxt_customer_flow_found);
					var customerList = data.context.cxt_matched_customer_list;
					console.log("customer list from context variable=>" + JSON.stringify(customerList));
					var inOperatorCustomer = '';
					console.log("Customer List Length=>" + customerList.length);
					for (i = 0; i < customerList.length; i++) {

						inOperatorCustomer += "'" + customerList[i].value.toLowerCase() + "'";

						if (i < customerList.length - 1) {
							inOperatorCustomer += ",";
						}


					}


					var sql = "Select MPLSVPN_NAME,IFACE_VLANID,NID from  tellabs_ods.ebu_vlan_status_v where LOWER(MPLSVPN_NAME) in  (" + inOperatorCustomer + ") ";
					data.context.cxt_customer_query = sql;
					console.log("Customer SQL so far =>" + sql);
				}

				if (data.context.cxt_user_selected_customer == null && data.context.cxt_customer_query != null && data.context.cxt_customer_drill_down_region != null) {

					var sql = data.context.cxt_customer_query;
					sql += " AND LOWER(MPLSVPN_NAME) like '%" + data.context.cxt_customer_drill_down_region.toLowerCase() + "%'"
					console.log("Customer SQL so far =>" + sql);
					var connection = getOracleDBConnection(sync);
					var listOfCustomerOutput = getOracleQueryResult(connection, sql, sync);
					doRelease(connection);
					var matchedCustomerOnRegion = "<table class='w-50'><tr>";
					var customerArr = [];

					//if (listOfCustomerOutput.rows.length > 0) {
					
					for (i = 0; i < listOfCustomerOutput.rows.length; i++) {
						//console.log("checking duplicates");
						//if (!containsValue(customerArr, listOfCustomerOutput.rows[i].MPLSVPN_NAME)) {
							customerArr[i]=listOfCustomerOutput.rows[i].MPLSVPN_NAME
							matchedCustomerOnRegion += "<tr>";
							matchedCustomerOnRegion += "<td>" + listOfCustomerOutput.rows[i].MPLSVPN_NAME + "</td>";
							matchedCustomerOnRegion += "<td>" + listOfCustomerOutput.rows[i].IFACE_VLANID + "</td>";
							matchedCustomerOnRegion += "</tr>";
						//} else {
						///	console.log("value exists");
						//}


					}
					matchedCustomerOnRegion += "</table>";

					console.log("outputText=>" + data.output.text[0]);

					outputText = S(data.output.text[0]).replaceAll('[region_filtered_customer_list]',  matchedCustomerOnRegion).s;
				//} else {
				//	outputText = "<b>Sorry no customer available for this region.</b>";
				//}

				}

				if (data.context.cxt_user_selected_customer != null) {

					//var sql = data.context.cxt_customer_query;
					// show incident data here for selected customer.
					var sql = "Select NID from  tellabs_ods.ebu_vlan_status_v where LOWER(MPLSVPN_NAME) = '" + data.context.cxt_user_selected_customer.toLowerCase() + "'"
					data.context.cxt_customer_flow_node_detail_query_executed = true; // this flag will help to clear the context variables for customer.
					console.log(sql);
					var connection = getOracleDBConnection(sync);
					var output = getOracleQueryResult(connection, sql, sync);
					doRelease(connection);

					var nodeId = null;
					if (output != null && output.rows != null) {
						nodeId = output.rows[0].NID;
					}

					var nodeOutput = null;
					if (nodeId != null) {
						var nodeSql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and (inc.HPD_CI = 'NODE" + nodeId + "'";
						for (j = 1; j < output.rows.length; j++) {
							nodeId = output.rows[j].NID;
							nodeSql += " OR inc.HPD_CI = 'NODE" + nodeId + "'"
						}
						nodeSql += ")";
						console.log(nodeSql);
						var connection = getOracleDBConnectionRemedy(sync);
						nodeOutput = getOracleQueryResult(connection, nodeSql, sync);

						doRelease(connection);
					}
					//console.log(output.data.rows);
					//outputText = data.output.text[0];
					if (nodeOutput != null && nodeOutput.rows.length == 0) {

						outputText = "<br/><b>I could not find any incident data for this customer in Remedy. If you like to speak to an operator please dial 082918.<br/></b>";


						//data.context.cxt_show_customer_selected_name = null;


					} else {

						outputText = "<table class='w-100'>";
						outputText += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
						for (i = 0; i < nodeOutput.rows.length; i++) {


							outputText += "<tr><td>" + nodeOutput.rows[i].INCIDENT_NUMBER + "</td><td>" + nodeOutput.rows[i].SUMMARY + "</td><td>" + nodeOutput.rows[i].INC_STATUS + "</td><td>" + nodeOutput.rows[i].SITE_NAME + "</td></tr>";

						}
						outputText += "</table><br/>";




					}

					outputText = addFeedbackButton(outputText);
					outputText += data.output.text[0]; // what else i can do for you message.
					

				}




				if (data != null && data.context.cxt_user_logged_in) {

					console.log("user is logged in now checking intent");
					/* SITES intent and context variable code */
					outputText = handleSitesIntent(data, inputText, outputText, sync);

					/*Incident Intent Handling.*/
					outputText = handleIncidentIntent(data, inputText, outputText, incidentFlow, sync);


					/*Region Intent Handling.*/
					outputText = handleRegionIntent(data, inputText, outputText, sync);



					/*Corporate Customer Intent handling.*/
					outputText = handleCustomerIntent(data, inputText, outputText, incidentFlow, sync);


					/*
						transmission failure Intent handling.
					*/
					outputText = handleTransmissionFailureIntent(data, inputText, outputText, sync);


					/*
					Escalation Intent Handling.
					*/
					outputText = handleEscalationIntent(data, inputText, outputText, await, defer, discovery);


					//console.log("replacing location name in message if there are any.");
					if (data.output.text[0] != null && S(data.output.text[0]).contains('Common locations are') && data.context.cxt_location_name_trx_flow == null && data.context.cxt_region_name != null) {
						//console.log("replacing location name in message if there are any.");
						data.output.text[0] = updateSuggestedLocationsInMessage(data.output.text[0], data.context.cxt_region_name, sync);
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
