module.exports = function () {
	var excelbuilder = require('msexcel-builder');
	var S = require('string');
	require('./stringhandler')();
	var excelGenerationRecordCountLimit = 10;
	var incidentTableName = "ARADMIN.HPD_HELP_DESK inc";
	var incidentTableName_2 = "ARADMIN.HPD_HELP_DESK inc_2";

	var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,inc.ASSIGNED_GROUP,inc.RESOLUTION_CATEGORY_TIER_2 as RESOLUTION_CATEGORY_TIER_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

	var incidentTableJoinTaskTable = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,tas.ASSIGNEE_GROUP as TASK_ASSIGNEE_GROUP,tas.ASSIGNEE as TASK_ASSIGNEE,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

	// Orchestration Layer Methods 
	this.orchestrateBotResponseTextForSiteName = function (dbQueryResult, outputText, response, childCount) {
		console.log("orchestrateBotResponseTextForSiteName = >Length of rows =>" + dbQueryResult.length);
		//console.log ("Output =>" + outputText);
		if (dbQueryResult != null && dbQueryResult.length == 0) {
			outputText = "Sorry, <b><a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >no</a></b> result can be found against given incident number.";
		}
		if (dbQueryResult != null && dbQueryResult.length >= 1) {

			outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].impact).s;
			outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].region).s;
			outputText = S(outputText).replaceAll('[site_name]', dbQueryResult[0].SITE_NAME).s;
			outputText = S(outputText).replaceAll('[status]', dbQueryResult[0].INC_STATUS).s;
			outputText = S(outputText).replaceAll('[assigned_to]', dbQueryResult[0].ASSIGNED_GROUP).s;
			outputText = S(outputText).replaceAll('[incident_summary]', dbQueryResult[0].SUMMARY).s;
			outputText = S(outputText).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
			outputText = S(outputText).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;
			console.log("Output after replace =>" + outputText);
			if (dbQueryResult[0].INC_STATUS.toLowerCase() == 'closed') {

				outputText += "<br/><b>Incident Event Start:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_START_TIME + "</i> <br/> <b>Incident Event Closed:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_END_TIME + "</i>.";
				outputText += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].RESOLUTION_CATEGORY_TIER_3 + "";
			}
			if (dbQueryResult[0].PARENT_INCIDENT_NUMBER == '' || dbQueryResult[0].PARENT_INCIDENT_NUMBER == null) { // incident is master incident
				response.context.cxt_is_master_incident = true;
				response.context.cxt_incident_number = dbQueryResult[0].INCIDENT_NUMBER;
				var child_incident_count = childCount;
				response.context.cxt_child_incident_count = child_incident_count;

				outputText += "<br/><br/> I also found that  <b>" + dbQueryResult[0].INCIDENT_NUMBER + "</b> is a <b>master</b> incident ";
				if (childCount > 0) {
					outputText += "and it has " + child_incident_count + " child incidents, if you like to see these incidents detail, reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";
				} else {
					response.context.cxt_incident_number = -1;
					outputText += "and it does not have any child incidents.<br/><br/> Is there anything i can help you with? I have information about incident, region, customer, transmission failure and shift reports. Please choose one.?";
				}
			} else {
				response.context.cxt_is_master_incident = false;
				response.context.cxt_parent_incident_number = dbQueryResult[0].PARENT_INCIDENT_NUMBER;
				outputText += "<br/><br/> I found that " + dbQueryResult[0].INCIDENT_NUMBER + " child of master incident " + dbQueryResult[0].PARENT_INCIDENT_NUMBER + ". if you like to see the detail of master incident, reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";
			}


			outputText = addFeedbackButton(outputText);

		}

		return outputText;

	}

	this.showParentIncidentDetails = function (dbQueryResult, outputText, data) {
		var outputText_new = '';
		outputText_new = "Please see details below for Master incident <b>" + dbQueryResult[0].INCIDENT_NUMBER + "</b>.<br/><br/>";
		outputText_new += "This incident was logged for <b><i>[site_name]</i></b> in the <b><i>[region]</i></b>.<br/>The status is <b><i>[status]</i></b>, impact is set to <b><i>[impact]</i></b> and it has been assigned to the <b><i>[assigned_to]</i></b>.<br/>        <b>Incident Summary :</b> [incident_summary]<br/><b>Task Assignee group :</b> [task_assignee_group]<br><b>Task Assignee :</b> [task_assignee]";

		outputText_new = S(outputText_new).replaceAll('[impact]', dbQueryResult[0].IMPACT).s;
		outputText_new = S(outputText_new).replaceAll('[region]', dbQueryResult[0].REGION).s;
		outputText_new = S(outputText_new).replaceAll('[site_name]', dbQueryResult[0].SITE_NAME).s;
		outputText_new = S(outputText_new).replaceAll('[status]', dbQueryResult[0].INC_STATUS).s;
		outputText_new = S(outputText_new).replaceAll('[assigned_to]', dbQueryResult[0].ASSIGNED_GROUP).s;
		outputText_new = S(outputText_new).replaceAll('[incident_summary]', dbQueryResult[0].SUMMARY).s;
		outputText_new = S(outputText_new).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
		outputText_new = S(outputText_new).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;

		if (dbQueryResult[0].INC_STATUS.toLowerCase() == 'closed') {
			outputText_new += "<br/><b>Incident Event Start:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_START_TIME + "</i> <br/> <b>Incident Event Closed:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_END_TIME + "</i>.";
			outputText_new += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].RESOLUTION_CATEGORY_TIER_3 + "";
		}


		//console.log("response.output.text[1]"+response.output.text[1]);
		outputText = outputText_new + "<br/>" + data.output.text[1];// += response.output.text[1];// += outputText_new;"<br/><br/>"+ data.output.text[1];
		outputText = addFeedbackButton(outputText);
		return outputText;

	}

	this.showChildIncidents = function (dbQueryResult, outputText, data, conversationId) {
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
				outputText_new += "<tr><td><a id='inc_link_ci'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

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

	this.orchestrateBotResponseTextForIncident = function (dbQueryResult, outputText, response, childCount) {
		console.log("orchestrateBotResponseTextForIncident = >Length of rows =>" + dbQueryResult.length);
		//console.log ("dbQueryResult =>" + JSON.stringify(dbQueryResult));
		if (dbQueryResult != null && dbQueryResult.length == 0) {
			outputText = "Sorry, no result can be found against given incident number.";
		}
		if (dbQueryResult != null && dbQueryResult.length >= 1) {

			outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].IMPACT).s;
			outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].REGION).s;
			outputText = S(outputText).replaceAll('[site_name]', dbQueryResult[0].SITE_NAME).s;
			outputText = S(outputText).replaceAll('[status]', dbQueryResult[0].INC_STATUS).s;
			outputText = S(outputText).replaceAll('[assigned_to]', dbQueryResult[0].ASSIGNED_GROUP).s;
			outputText = S(outputText).replaceAll('[incident_summary]', dbQueryResult[0].SUMMARY).s;
			outputText = S(outputText).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
			outputText = S(outputText).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;
			console.log("Output after replace =>" + outputText);
			outputText += "<br/><i><b>Incident Event Start:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_START_TIME;
			if (dbQueryResult[0].INC_STATUS.toLowerCase() == 'closed') {

				outputText += "<br/><b>Incident Event Closed:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_END_TIME + "</i>.";
				outputText += "<br/><b>Cause: </b>" + dbQueryResult[0].CAUSE_TIER_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].RESOLUTION_CATEGORY_TIER_3 + "";
			}
			if (dbQueryResult[0].PARENT_INCIDENT_NUMBER == '' || dbQueryResult[0].PARENT_INCIDENT_NUMBER == null) { // incident is master incident
				response.context.cxt_is_master_incident = true;
				response.context.cxt_incident_number = dbQueryResult[0].INCIDENT_NUMBER;
				var child_incident_count = childCount;
				response.context.cxt_child_incident_count = child_incident_count;

				outputText += "<br/> I also found that  <b>" + dbQueryResult[0].INCIDENT_NUMBER + "</b> is a <b>" + dbQueryResult[0].RELATIONSHIP_TYPE + "</b> incident ";
				if (childCount > 0) {
					outputText += "and it has <b>" + child_incident_count + "</b> child incidents, if you like to see these incidents detail, reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";

				} else {
					response.context.cxt_incident_number = -1;
					outputText += "and it does not have any child incidents.<br/><br/> <b>Is there anything i can help you with? I have information about incident, region, customer, transmission failure and shift reports. Please choose one.</b>";

				}
			} else {
				response.context.cxt_is_master_incident = false;
				response.context.cxt_parent_incident_number = dbQueryResult[0].PARENT_INCIDENT_NUMBER;
				outputText += "<br/> I found that " + dbQueryResult[0].INCIDENT_NUMBER + " is " + dbQueryResult[0].RELATIONSHIP_TYPE + " of " + dbQueryResult[0].PARENT_INCIDENT_NUMBER + ". If you like to see the detail of master incident, reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";

			}

			outputText = addFeedbackButton(outputText);


		}

		return outputText;
	}

	this.orchestrateBotResponseTextForRegion = function (dbQueryResult, outputText, regionName_2, data, sync) {
		console.log("orchestrateBotResponseTextForRegion = >");
		var masterIncidentCount = 0;
		var childIncidentCount = 0;
		//if (dbQueryResult != null) {

		var childIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as CHILDCOUNT from " + incidentTableName + " where (inc.INCIDENT_ASSOCIATION_TYPE = 1 and  inc.STATUS in (0,1,2,3)) and LOWER(inc.region) = '" + regionName_2.toLowerCase() + "'";
		console.log("childIncidentCountsql =>" + childIncidentCountsql);
		var connection = getOracleDBConnectionRemedy(sync);
		var childIncidentCountResult = getOracleQueryResult(connection, childIncidentCountsql, sync);
		doRelease(connection);
		//console.log("masterIncidentCountResult=>"+JSON.stringify(masterIncidentCountResult));
		childIncidentCount = childIncidentCountResult.rows[0].CHILDCOUNT;
		data.context.cxt_child_incident_count_for_region = childIncidentCount;
		// association type 1 = child , 0 = master, null = standalone
		var masterIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as MASTERCOUNT from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) and LOWER(inc.region) = '" + regionName_2.toLowerCase() + "' ";
		//var masterIncidentCountsql = "Select count(distinct inc.ORIGINAL_INCIDENT_NUMBER) as MASTERCOUNT from "+incidentTableName+" inner join "+incidentTableName_2+" on (inc.ORIGINAL_INCIDENT_NUMBER = inc_2.INCIDENT_NUMBER and inc_2.INCIDENT_ASSOCIATION_TYPE  = 0) where LOWER(inc.region) = '" + regionName_2.toLowerCase() + "' and inc_2.STATUS not in (5,6) ";//and inc_2.STATUS not in (5,6)
		//var childIncidentCountsql = "Select count(*) as CHILDCOUNT from "+incidentTableName+" inner join "+incidentTableName_2+" on (inc.ORIGINAL_INCIDENT_NUMBER = inc_2.INCIDENT_NUMBER) where LOWER(inc.region) like '%" + regionName_2.toLowerCase() + "%' and inc.ORIGINAL_INCIDENT_NUMBER is not null and inc.STATUS not in (5,6) and inc_2.STATUS not in (5,6)";
		console.log("masterIncidentCountsql =>" + masterIncidentCountsql);
		var connection = getOracleDBConnectionRemedy(sync);
		var masterIncidentCountResult = getOracleQueryResult(connection, masterIncidentCountsql, sync);
		//console.log("childIncidentCountResult=>"+JSON.stringify(childIncidentCountResult));
		doRelease(connection);
		//var childIncidentCountResult = executeQuerySync(childIncidentCountsql);
		masterIncidentCount = masterIncidentCountResult.rows[0].MASTERCOUNT;
		var totalCount = masterIncidentCount + childIncidentCount;

		if (totalCount > 0) {
			var is_are = "is";
			if (masterIncidentCount > 1) {
				is_are = "are";
			}
			outputText = data.output.text[0];
			/*if (data.output.text[1] != null) {
				outputText += data.output.text[1];
			}*/
			//data.context.cxt_region_name = dbQueryResult[0].region;
			//console.log("dbQueryResult=>"+JSON.stringify(dbQueryResult));
			outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + totalCount + "</b>").s;
			outputText = S(outputText).replaceAll('[region_name]', "<b>" + regionName_2 + "</b>").s;
			outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[is_are]', is_are).s;
			outputText += "<br/><br/>Would you like to see details of master incident with linked child incidents or are you looking for an isolated fault? Please reply with <a href='#' id='master' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>master</a> or <a href='#' id='fault' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >fault</a>.";

		} else {
			outputText = "Sorry, no result can be found against given region " + regionName_2;
		}


		//}


		//outputText = addFeedbackButton(outputText);

		return outputText;

	}

	this.updateSuggestedLocationsInMessage = function (messageText, regionCode, sync) {
		// using materialized view name_repo.NMG_CHATBOT_MV
		var locationQuery = "SELECT DISTINCT REPO_LOCATION_NAME AS LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE LOWER(region) = '" + regionCode.toLowerCase() + "' AND ROWNUM < 20";
		/*var locationQuery = "SELECT distinct l.name as location_name,l.object_key as location_key, l.atoll_id, l.remedy_name as remedy_location_name, n.OBJECT_CLASS, n.OBJECT_KEY, n.NAME as CI_NAME, n.NODE_STATUS, n.PARENT_NODE, n.REMEDY_STATUS, n.REMEDY_ID"+
							 " FROM name_repo.node_v n JOIN name_repo.site_v l ON n.site = l.object_key WHERE ROWNUM < 11 and n.NODE_STATUS = 'In Service' and l.remedy_name like '%" + regionCode + "%' ";*/
		console.log("Query for updating locations in message. =>" + locationQuery);
		//var locationsResultSet = executeQuerySync(locationQuery);
		var connection = getOracleDBConnection(sync);
		var locationsResultSet = getOracleQueryResult(connection, locationQuery, sync);
		doRelease(connection);
		if (messageText == null) {
			messageText = '';
		}
		if (locationsResultSet != null && locationsResultSet.rows.length > 0) {
			messageText = "<b>Select the location name. Common Locations are</b> <br/>";
			for (i = 0; i < locationsResultSet.rows.length; i++) {
				messageText += "<a href='#' id='location_'"+i+" onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>"+locationsResultSet.rows[i].LOCATION_NAME+"</a>";
				if (i < locationsResultSet.rows.length - 1)
					messageText += ",&nbsp;";
				if (i > 0 && i % 8 == 0) {
					messageText += "<br/>";
				}

			}


		}
		return messageText;
	}

	this.showIncidentsForSiteName = function (dbQueryResult, outputText, data, conversationId) {
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
				outputText_new += "<tr><td><a id='inc_lnk_ci'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td><a id='ci_lnk_ci'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].SITE_NAME + "</a></td></tr>";

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

	this.DisplyDetailsForMasterIncidents = function (dbQueryResult, outputText, data, conversationId) {
		var outputText_new = "";

		if (dbQueryResult.length == 0) {
			outputText_new = "There are <b>no</b> master incidents.<br/>";
		} else {

			if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				var excelFileName = "masterIncidentListBasedOnRegion_" + conversationId + "_" + new Date().getTime() + ".xlsx";
				//outputText_new +="Please see details below for 10 incidents only. <br/>";
				outputText_new += "Please see details for incidents in excel sheet.<br/>";
				outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
				console.log("Master Incidents Count For Region=>" + dbQueryResult.length);
				buildExcelSheet(excelFileName, dbQueryResult, 4);
			} else {
				outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> master incidents.<br/>";
				outputText_new += "<table class='w-80'>";
				outputText_new += "<tr><th>INCIDENT NUMBER</th><th>STATUS</th><th>DESCRIPTION</th><th>REGION</th><th>SITE NAME</th></tr>";
				for (i = 0; i < dbQueryResult.length; i++) {
					if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
						break;
					}
					outputText_new += "<tr><td><a id='inc_lnk_mi'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].REGION + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

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

	this.showMasterIncidentsForRegion = function (dbQueryResult, outputText, data, conversationId) {
		var outputText_new = "";

		if (dbQueryResult.length == 0) {
			outputText_new = "There are <b>no</b> master incidents that have child associations.<br/>";
		} else {

			if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				var excelFileName = "masterIncidentListBasedOnRegion_conv-" + conversationId + "_cnt-" + dbQueryResult.length + "_dt-" + new Date().getTime() + ".xlsx";
				//outputText_new +="Please see details below for 10 incidents only. <br/>";
				outputText_new += "Please see details for incidents in excel sheet.<br/>";
				outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
				console.log("Excel Sheet rows =>" + dbQueryResult.length);
				buildExcelSheet(excelFileName, dbQueryResult, 4);
			} else {
				outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> " + dbQueryResult[0].RELATIONSHIP_TYPE + " incidents that have child association. <br/>";
				outputText_new += "<table class='w-80'>";
				outputText_new += "<tr><th>Child Count</th><th>PARENT INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
				for (i = 0; i < dbQueryResult.length; i++) {
					if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
						break;
					}
					
					outputText_new += "<tr><td>" + dbQueryResult[i].COUNT + "</td><td><a id='p_inc_lnk_r'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].PARENT_INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

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

	this.showIncidentsForRegionBasedOnLocation = function (dbQueryResult, outputText, data, conversationId) {
		var outputText_new = "";
		var excelFileName = "incidentListInRegionBasedOnLocation_" + conversationId + "_" + new Date().getTime() + ".xlsx";
		if (dbQueryResult != null && dbQueryResult.length != 0) {
			outputText_new = "There are total <b>" + dbQueryResult.length + "</b> incidents. ";
		} else {
			outputText_new = "<b>No incident data available in remedy for location " + data.context.cxt_location_name_region_flow + "</b>. <br/><br/>";

		}
		if (dbQueryResult != null && dbQueryResult.length > excelGenerationRecordCountLimit) {
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=window.open('/download/?file=" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else if (dbQueryResult != null && dbQueryResult.length > 0) {
			outputText_new += "Please see details below for <b>" + dbQueryResult.length + "</b> incidents only. <br/>";
			outputText_new += "<table class='w-80'>";
			outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {

				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				outputText_new += "<tr><td><a id='inc_lnk_'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

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

	this.showIncidentsForTransmissionFailureOnLocation = function (dbQueryResult, outputText, data, conversationId) {

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

				outputText_new += "<tr><td><a id='inc_lnk_'"+i+" href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

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

	this.orchestrateBotResponseTextForCustomer = function (customerCount, data, regionName) {
		outputText = data.output.text;
		data.context.cxt_matched_customer_count = customerCount;
		if (customerCount > 0) {
		console.log("orchestrateBotResponseTextForCustomer = >Length of rows =>" + customerCount);
		outputText = S(outputText).replaceAll('[no_of_customers]', "<b>" + customerCount + "</b>").s;
		outputText = S(outputText).replaceAll('[region_name]', "<b>" + regionName + "</b>").s;
		
		} else {
			outputText = "<br/><b>Sorry no result found for specified customer in "+regionName+".<br/> Reply with yes to search again.</b>";
		}

		return outputText;

	}

	this.orchestrateBotResponseTextForTransmissionFailures = function (dbQueryResult, outputText, data, sync) {

		console.log("orchestrateBotResponseTextForTransmissionFailures");
		var masterIncidentCount = 0;
		var childIncidentCount = 0;
		var outputText_new = '';
		//if (dbQueryResult != null) {

		var cause_tier_1 = data.context.cxt_tx_name;
		var childIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as CHILDCOUNT from " + incidentTableName + " where (inc.INCIDENT_ASSOCIATION_TYPE = 1 and  inc.STATUS in (0,1,2,3)) and LOWER(inc.GENERIC_CATEGORIZATION_TIER_2) = '" + cause_tier_1.toLowerCase() + "'";
		console.log("childIncidentCountsql =>" + childIncidentCountsql);
		var connection = getOracleDBConnectionRemedy(sync);
		var childIncidentCountResult = getOracleQueryResult(connection, childIncidentCountsql, sync);
		doRelease(connection);
		//console.log("masterIncidentCountResult=>"+JSON.stringify(masterIncidentCountResult));
		childIncidentCount = childIncidentCountResult.rows[0].CHILDCOUNT;
		data.context.cxt_child_incident_count_for_region = childIncidentCount;
		// association type 1 = child , 0 = master, null = standalone
		var masterIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as MASTERCOUNT from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) and LOWER(inc.GENERIC_CATEGORIZATION_TIER_2) = '" + cause_tier_1.toLowerCase() + "' ";
		//var masterIncidentCountsql = "Select count(distinct inc.ORIGINAL_INCIDENT_NUMBER) as MASTERCOUNT from "+incidentTableName+" inner join "+incidentTableName_2+" on (inc.ORIGINAL_INCIDENT_NUMBER = inc_2.INCIDENT_NUMBER and inc_2.INCIDENT_ASSOCIATION_TYPE  = 0) where LOWER(inc.region) = '" + regionName_2.toLowerCase() + "' and inc_2.STATUS not in (5,6) ";//and inc_2.STATUS not in (5,6)
		//var childIncidentCountsql = "Select count(*) as CHILDCOUNT from "+incidentTableName+" inner join "+incidentTableName_2+" on (inc.ORIGINAL_INCIDENT_NUMBER = inc_2.INCIDENT_NUMBER) where LOWER(inc.region) like '%" + regionName_2.toLowerCase() + "%' and inc.ORIGINAL_INCIDENT_NUMBER is not null and inc.STATUS not in (5,6) and inc_2.STATUS not in (5,6)";
		console.log("masterIncidentCountsql =>" + masterIncidentCountsql);
		var connection = getOracleDBConnectionRemedy(sync);
		var masterIncidentCountResult = getOracleQueryResult(connection, masterIncidentCountsql, sync);
		//console.log("childIncidentCountResult=>"+JSON.stringify(childIncidentCountResult));
		doRelease(connection);
		//var childIncidentCountResult = executeQuerySync(childIncidentCountsql);
		masterIncidentCount = masterIncidentCountResult.rows[0].MASTERCOUNT;
		var totalCount = masterIncidentCount + childIncidentCount;
		data.context.cxt_tx_found_incident_count = totalCount;
		var is_are = "is";
		if (childIncidentCount > 1) {
			is_are = "are";
		}
		outputText = data.output.text[0];
		if (data.output.text[1] != null) {
			outputText += "<br/>" + data.output.text[1];
		}
		//	data.context.cxt_region_name = dbQueryResult[0].region;
		outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + totalCount + "</b>").s;
		outputText = S(outputText).replaceAll('[failure_type_name]', "<b>" + cause_tier_1 + "</b>").s;
		outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
		outputText = S(outputText).replaceAll('[is_are]', is_are).s;
		if (totalCount) {
			outputText_new = "<br/>Do you want to further drill down the search? reply with <b>yes or no</b>.";
		} else {
			outputText_new = "<br/><b>No</b> incidents found against the given domain. If you want to search anything else reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";
		}


		//}
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

	this.addFeedbackButton = function (outputText) {
		outputText += "<br/><b>Please vote on feedback provided.</b>&nbsp;&nbsp;<img src='img/thumbsup-blue.png' class='feedback-img' title='good' onClick='openWindow(1);' />&nbsp;&nbsp;<img src='img/thumbsdown-red.png' class='feedback-img' title='bad' onClick='LogThumbsDown();' /><br/>";
		return outputText;
	}

	this.buildExcelSheet = function buildExcelSheet(excelSheetName, dbQueryResult, noOfColumns) {

		// Create a new workbook file in current working-path 
		var workbook = excelbuilder.createWorkbook('./', excelSheetName)

		// Create a new worksheet with 10 columns and 12 rows 
		var numberOfRows = dbQueryResult.length;
		console.log("Number of rows in excel sheet=>" + numberOfRows);
		var sheet1 = workbook.createSheet('data', noOfColumns, Number(numberOfRows) + Number(1));

		// Fill some data 

		sheet1.set(1, 1, 'Incident Number');
		sheet1.set(2, 1, 'Description');
		sheet1.set(3, 1, 'Status');
		sheet1.set(4, 1, 'Site Name');
		if (noOfColumns == 5) {
			sheet1.set(5, 1, 'Child Count');
		}
		var j = 0;
		var numberOfRowsNew = Number(numberOfRows) + Number(2);
		//console.log("excel query result =>"+JSON.stringify(dbQueryResult));
		for (var i = 2; i < numberOfRowsNew; i++) {
			//sheet1.set(col, row, data);
			//console.log(i);
			sheet1.set(1, i, dbQueryResult[j].INCIDENT_NUMBER);
			sheet1.set(2, i, dbQueryResult[j].SUMMARY);
			sheet1.set(3, i, dbQueryResult[j].INC_STATUS);
			sheet1.set(4, i, dbQueryResult[j].SITE_NAME);
			if (noOfColumns == 5) {
				sheet1.set(5, i, dbQueryResult[j].COUNT);
			}
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




};