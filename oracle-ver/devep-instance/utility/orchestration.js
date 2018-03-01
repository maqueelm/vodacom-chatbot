/**
 * Description
 * @method exports
 * @return 
 */
module.exports = function () {
	var excelbuilder = require('msexcel-builder');
	var S = require('string');
	require('./stringhandler')();
	require('./sqlhandler')();
    require('./watsonentityhandler')();
	var excelGenerationRecordCountLimit = process.env.GENERATE_EXCEL_IF_RECORDS_GREATER_THAN;

	// Orchestration Layer Methods 
	/**
	 * Description
	 * @method orchestrateBotResponseTextForSiteName
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} childCount
	 * @return outputText
	 */
	this.orchestrateBotResponseTextForSiteName = function (dbQueryResult, outputText, response, childCount) {
		console.log("orchestrateBotResponseTextForSiteName = >Length of rows =>" + dbQueryResult.length);
		//console.log ("Output =>" + outputText);
		if (dbQueryResult != null && dbQueryResult.length == 0) {
			outputText = "Sorry, <b><a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >no</a></b> result can be found against given incident number.";
		}
		if (dbQueryResult != null && dbQueryResult.length >= 1) {

			outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].impact).s;
			outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].region).s;
			var siteName = dbQueryResult[0].SITE_NAME;
			siteName = S(siteName).replaceAll(' ', '').s;
			var siteNameLink = "<a href='#' id='" + siteName + "' onclick='copyToTypingArea(this);'>" + siteName + "</a>";

			outputText = S(outputText).replaceAll('[site_name]', siteNameLink).s;
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

	/**
	 * Description
	 * @method showParentIncidentDetails
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @return response
	 */
	this.showParentIncidentDetails = function (dbQueryResult, outputText, response) {
		var outputText_new = '';
		if (dbQueryResult.length > 0) {
			outputText_new = "Please see details below for Master incident <b>" + dbQueryResult[0].INCIDENT_NUMBER + "</b>.<br/><br/>";
			outputText_new += "This incident was logged for <b><i>[site_name]</i></b>.<br/>The status is <b><i>[status]</i></b> and it has been assigned to the <b><i>[assigned_to]</i></b>.<br/> <b>Incident Summary :</b> [incident_summary]<br/><b>Incident Event Start Time :</b>[incident_event_start_time]<br/><b>Task Assignee group :</b> [task_assignee_group]<br><b>Task Assignee :</b> [task_assignee]<br><b>Task Last Update Date :</b> [WORK_LOG_DATE]<br><b>Task Description :</b> [DETAILED_DESCRIPTION]";

			outputText_new = S(outputText_new).replaceAll('[impact]', dbQueryResult[0].IMPACT).s;
			outputText_new = S(outputText_new).replaceAll('[region]', dbQueryResult[0].REGION).s;
			var siteName = dbQueryResult[0].SITE_NAME;
			siteName = S(siteName).replaceAll(' ', '').s;
			var siteNameLink = "<a href='#' id='" + siteName + "' onclick='copyToTypingArea(this);'>" + siteName + "</a>";

			outputText_new = S(outputText_new).replaceAll('[site_name]', siteNameLink).s;
			outputText_new = S(outputText_new).replaceAll('[status]', dbQueryResult[0].INC_STATUS).s;
			outputText_new = S(outputText_new).replaceAll('[assigned_to]', dbQueryResult[0].ASSIGNED_GROUP).s;
			outputText_new = S(outputText_new).replaceAll('[incident_summary]', dbQueryResult[0].SUMMARY).s;
			outputText_new = S(outputText_new).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
			outputText_new = S(outputText_new).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;
			outputText_new = S(outputText_new).replaceAll('[incident_event_start_time]', dbQueryResult[0].INCIDENT_EVENT_START_TIME).s;
			if (dbQueryResult[0].TASK_ASSIGNEE_GROUP) {
				outputText_new = S(outputText_new).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
			} else {
				outputText_new = S(outputText_new).replaceAll('[task_assignee_group]', null).s;
			}
			if (dbQueryResult[0].TASK_ASSIGNEE) {
				outputText_new = S(outputText_new).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;
			} else {
				outputText_new = S(outputText_new).replaceAll('[task_assignee]', null).s;
			}

			if (dbQueryResult[0].DETAILED_DESCRIPTION) {
				outputText_new = S(outputText_new).replaceAll('[DETAILED_DESCRIPTION]', dbQueryResult[0].DETAILED_DESCRIPTION).s;
			} else {
				outputText_new = S(outputText_new).replaceAll('[DETAILED_DESCRIPTION]', null).s;
			}

			if (dbQueryResult[0].WORK_LOG_DATE) {
				outputText_new = S(outputText_new).replaceAll('[WORK_LOG_DATE]', dbQueryResult[0].WORK_LOG_DATE).s;
			} else {
				outputText_new = S(outputText_new).replaceAll('[WORK_LOG_DATE]', null).s;
			}
			if (dbQueryResult[0].INC_STATUS.toLowerCase() == 'closed') {
				outputText_new += "<b>Incident Event Closed:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_END_TIME + "</i>.";
				outputText_new += "<br/><b>Cause: </b>" + dbQueryResult[0].cause_tier_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].RESOLUTION_CATEGORY_TIER_3 + "";
			}

		} else {
			outputText_new = "<b>This incident is closed now.</b>";
		}


		//console.log("response.output.text[1]"+response.output.text[1]);
		outputText = outputText_new;// + data.output.text[1];// += response.output.text[1];// += outputText_new;"<br/><br/>"+ data.output.text[1];
		outputText = addFeedbackButton(outputText);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[0] = outputText;
			response.output.text[1] = temp;

		} else {
			response.output.text[0] = outputText;
		}

		return response;

	}

	/**
	 * Description
	 * @method showChildIncidents
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} conversationId
	 * @return response
	 */
	this.showChildIncidents = function (dbQueryResult, outputText, response, conversationId) {
		var outputText_new = '';
		var excelFileName = "childIncidentList_" + conversationId + "_" + new Date().getTime() + ".xlsx";
		if (dbQueryResult.length > excelGenerationRecordCountLimit) {
			//outputText_new ="Please see details below for 10 child incidents only. <br/>";
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else {
			outputText_new = "Please see details below for <b>" + dbQueryResult.length + "</b> child incidents only. <br/>";

			outputText_new += "<table class='w-100'>";
			outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {

				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				outputText_new += "<tr><td><a id='" + dbQueryResult[i].INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

			}
			outputText_new += "</table><br/>";
		}
		//outputText = outputText_new;
		outputText_new = addFeedbackButton(outputText_new);

		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[0] = outputText_new;
			response.output.text[1] = temp;

		} else {
			response.output.text[0] = outputText_new;
		}

		//response.output.text[0] = outputText;

		return response;
	}

	/**
	 * Description
	 * @method orchestrateBotResponseTextForIncident
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} childCount
	 * @param {} sync
	 * @return response
	 */
	this.orchestrateBotResponseTextForIncident = function (dbQueryResult, outputText, response, childCount, sync) {
		console.log("orchestrateBotResponseTextForIncident = >Length of rows =>" + dbQueryResult.length);
		//console.log ("dbQueryResult =>" + JSON.stringify(dbQueryResult));
		if (dbQueryResult != null && dbQueryResult.length == 0) {
			outputText = "Sorry, no result can be found against given incident number.";
		}
		if (dbQueryResult != null && dbQueryResult.length >= 1) {

			outputText = S(outputText).replaceAll('[impact]', dbQueryResult[0].IMPACT).s;
			outputText = S(outputText).replaceAll('[region]', dbQueryResult[0].REGION).s;
			var siteName = dbQueryResult[0].SITE_NAME;
			siteName = S(siteName).replaceAll(' ', '').s;
			var siteNameLink = "<a href='#' id='" + siteName + "' onclick='copyToTypingArea(this);'>" + dbQueryResult[0].SITE_NAME + "</a>";
			outputText = S(outputText).replaceAll('[site_name]', siteNameLink).s;
			outputText = S(outputText).replaceAll('[status]', dbQueryResult[0].INC_STATUS).s;
			outputText = S(outputText).replaceAll('[assigned_to]', dbQueryResult[0].ASSIGNED_GROUP).s;
			outputText = S(outputText).replaceAll('[incident_summary]', dbQueryResult[0].SUMMARY).s;
			outputText = S(outputText).replaceAll('[incident_event_start_time]', dbQueryResult[0].INCIDENT_EVENT_START_TIME).s;
			if (dbQueryResult[0].TASK_ASSIGNEE_GROUP) {
				outputText = S(outputText).replaceAll('[task_assignee_group]', dbQueryResult[0].TASK_ASSIGNEE_GROUP).s;
			} else {
				outputText = S(outputText).replaceAll('[task_assignee_group]', null).s;
			}
			if (dbQueryResult[0].TASK_ASSIGNEE) {
				outputText = S(outputText).replaceAll('[task_assignee]', dbQueryResult[0].TASK_ASSIGNEE).s;
			} else {
				outputText = S(outputText).replaceAll('[task_assignee]', null).s;
			}

			if (dbQueryResult[0].DETAILED_DESCRIPTION) {
				outputText = S(outputText).replaceAll('[DETAILED_DESCRIPTION]', dbQueryResult[0].DETAILED_DESCRIPTION).s;
			} else {
				outputText = S(outputText).replaceAll('[DETAILED_DESCRIPTION]', null).s;
			}

			if (dbQueryResult[0].WORK_LOG_DATE) {
				outputText = S(outputText).replaceAll('[WORK_LOG_DATE]', dbQueryResult[0].WORK_LOG_DATE).s;
			} else {
				outputText = S(outputText).replaceAll('[WORK_LOG_DATE]', null).s;
			}
			if (dbQueryResult[0].INC_STATUS.toLowerCase() == 'closed') {

				outputText += "<br/><b>Incident Event Closed:</b> <i>" + dbQueryResult[0].INCIDENT_EVENT_END_TIME + "</i>.";
				outputText += "<br/><b>Cause: </b>" + dbQueryResult[0].CAUSE_TIER_3 + "<br/> <b>Resolution: </b>" + dbQueryResult[0].RESOLUTION_CATEGORY_TIER_3 + "";
			}
			if (dbQueryResult[0].PARENT_INCIDENT_NUMBER == '' || dbQueryResult[0].PARENT_INCIDENT_NUMBER == null) { // incident is master incident
				response.context.cxt_is_master_incident = true;
				response.context.cxt_incident_number = dbQueryResult[0].INCIDENT_NUMBER;
				var child_incident_count = childCount;
				response.context.cxt_child_incident_count = child_incident_count;
				console.log("dbQueryResult[0].INCIDENT_NUMBER=>" + JSON.stringify(dbQueryResult));
				if (dbQueryResult[0].INCIDENT_NUMBER == null) {
					outputText += "<br/> I also found that  this is a <b>" + dbQueryResult[0].RELATIONSHIP_TYPE + "</b> incident ";
				} else {
					outputText += "<br/> I also found that  <b>" + dbQueryResult[0].INCIDENT_NUMBER + "</b> is a <b>" + dbQueryResult[0].RELATIONSHIP_TYPE + "</b> incident ";
				}

				if (childCount > 0) {
					outputText += "and it has <b>" + child_incident_count + "</b> open child incidents, if you like to see these incidents detail, reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >Yes</a>&nbsp;<a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >No</a>.";
					//outputText = addFeedbackButton(outputText);
					response.output.text[0] = outputText;
				} else {
					response = resetEveryThing(response); // reset will always be called before getting watson response.
					response = getWatsonResponse(response, sync, null);
					var temp = response.output.text[0];
					outputText += "and it does not have any open child incidents.";
					outputText = addFeedbackButton(outputText);
					response.output.text[0] = outputText;
					response.output.text[1] = temp;
					//
					

				}
			} else {
				response.context.cxt_is_master_incident = false;
				response.context.cxt_parent_incident_number = dbQueryResult[0].PARENT_INCIDENT_NUMBER;
				outputText += "<br/> <b>I found that " + dbQueryResult[0].INCIDENT_NUMBER + " is " + dbQueryResult[0].RELATIONSHIP_TYPE + " of " + dbQueryResult[0].PARENT_INCIDENT_NUMBER + ". If you like to see the detail of master incident, reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a>&nbsp;<a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >No</a></b>.";
				//outputText = addFeedbackButton(outputText);
				response.output.text[0] = outputText;
			}
		}
		//console.log("response from incident orchestrator=>"+JSON.stringify(response));
		return response;
	}

	/**
	 * Description
	 * @method orchestrateBotResponseTextForRegion
	 * @param {} data
	 * @param {} sync
	 * @return data
	 */
	this.orchestrateBotResponseTextForRegion = function (data, sync) {
		console.log("orchestrateBotResponseTextForRegion");
		var masterIncidentCount = 0;
		var childIncidentCount = 0;
		var connection = getOracleDBConnectionRemedy(sync);
		childIncidentCount = getChildIncidentCountForRegion_SqlHandler(data,sync,connection);
			
		data.context.cxt_child_incident_count_for_region = childIncidentCount;
		// association type 1 = child , 0 = master, null = standalone
		var connection = getOracleDBConnectionRemedy(sync);
		masterIncidentCount = getMasterIncidentCountForRegion_SqlHandler(data,sync,connection);

		var totalCount = masterIncidentCount + childIncidentCount;
		if (totalCount > 0) {
			var is_are = "is";
			if (masterIncidentCount > 1) {
				is_are = "are";
			}
			var outputText = '';
			if (data.output.text[0] != null) {
				outputText = data.output.text[0];
			}

			outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + totalCount + "</b>").s;
			outputText = S(outputText).replaceAll('[region_name]', "<b>" + data.context.cxt_region_name + "</b>").s;
			outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[is_are]', is_are).s;
			if (data.output.text[0] != null) {
				data.output.text[0] = outputText;
			}
			//outputText += "<br/><br/>Would you like to see details of master incident with linked child incidents or are you looking for an isolated fault? Please reply with <a href='#' id='master' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>master</a> or <a href='#' id='fault' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >fault</a>.";

		} else {
			outputText = "<b>Sorry, no result can be found against given region " + data.context.cxt_region_name + "</b>";
			data = resetEveryThing(data);
			data = getWatsonResponse(data, sync, "yes");
			var temp = data.output.text[0];
			data.output.text[0] = outputText;
			data.output.text[1] = temp;

		}


		return data;

	}

	/**
	 * Description
	 * @method updateSuggestedLocationsInMessage
	 * @param {} messageText
	 * @param {} locationListQuery
	 * @param {} sync
	 * @return messageText
	 */
	this.updateSuggestedLocationsInMessage = function (messageText, locationListQuery, sync) {

		var locationsText = '';
		if (messageText == null) {
			messageText = '[trx_locations_here]';
		}
		var connection = getOracleDBConnection(sync);
		var locationList = getOracleQueryResult(connection, locationListQuery, sync);
		if (locationList != null && locationList.rows.length > 0) {
			locationsText = "<b>Select the location name.</b> <br/><table class='w-90'>";
			locationsText += "<tr><td><ul>";
			var columnCount = 0;
			for (i = 0; i < locationList.rows.length; i++) {
				var locationId = S(locationList.rows[i].LOCATION_NAME).replaceAll(' ', '').s;

				//locationsText += "</li>";
				if (i > 0 && i % 4 == 0) {
					locationsText += "</ul></td><td><ul>";
					columnCount++;
				}
				if (columnCount > 3) {
					locationsText += "</ul></td></tr><tr><td><ul>";
					columnCount = 0;
				}
				locationsText += "<li><a href='#' id='" + locationId + "' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + locationList.rows[i].LOCATION_NAME + "</a></li>";

			}
			locationsText += "</ul></td></tr></td></table>";


		} else {
			console.log("No Locations found ... displaying default locations");
		}
		messageText = S(messageText).replaceAll('[trx_locations_here]', locationsText).s;
		messageText = S(messageText).replaceAll('[isolated_fault_location_list_here]', locationsText).s;

		if (locationsText == '') {
			messageText = "<b>Select the location name. Common Locations are <a id='location_0' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>Bellville</a>,<a id='location_1' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>Century City</a></b> <br/>";
		}
		return messageText;
	}

	/**
	 * Description
	 * @method showIncidentsForSiteName
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} conversationId
	 * @return response
	 */
	this.showIncidentsForSiteName = function (dbQueryResult, outputText, response, conversationId) {
		var outputText_new;
		var excelFileName = "incidentListBasedOnSite_" + conversationId + "_" + new Date().getTime() + ".xlsx";
		if (dbQueryResult.length == 0) {
			outputText_new = "<b>Sorry no incident found against the given site name " + response.context.cxt_site_name_region_flow + ".</b><br/>";
			outputText_new = addFeedbackButton(outputText_new);
			if (response.output.text[0] != null) {
				var temp = response.output.text[0];
				response.output.text[1] = temp;
				response.output.text[0] = outputText_new;
			} else {
				response.output.text[0] = outputText_new;
			}


			return response;
		}
		outputText_new = "There are total <b>" + dbQueryResult.length + "</b> incidents. ";
		if (dbQueryResult.length > excelGenerationRecordCountLimit) {
			//outputText_new +="Please see details below for 10 incidents only. <br/>";
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else {
			outputText_new += "Please see details. <br/>";

			outputText_new += "<table class='w-100'>";
			outputText_new += "<tr><th style=''>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {

				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				var fullSummary = dbQueryResult[i].SUMMARY;
				var summary = fullSummary;
				if (fullSummary.length > 30) {
					summary = fullSummary.substr(0, 30) + " ....";
				}

				outputText_new += "<tr><td><a id='" + dbQueryResult[i].INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td title='" + fullSummary + "'>" + summary + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td><a id='" + dbQueryResult[i].SITE_NAME + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].SITE_NAME + "</a></td></tr>";

			}
			outputText_new += "</table><br/>";
		}

		outputText_new = addFeedbackButton(outputText_new);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[1] = temp;
			response.output.text[0] = outputText_new;
		} else {
			response.output.text[0] = outputText_new;
		}

		return response;
	}

	/**
	 * Description
	 * @method DisplyDetailsForMasterIncidents
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} conversationId
	 * @return MemberExpression
	 */
	this.DisplyDetailsForMasterIncidents = function (dbQueryResult, outputText, response, conversationId) {
		var outputText_new = "";

		if (dbQueryResult.length == 0) {
			outputText_new = "There are <b>no</b> master incidents.<br/>";
		} else {

			if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				var excelFileName = "masterIncidentListBasedOnRegion_" + conversationId + "_" + new Date().getTime() + ".xlsx";
				//outputText_new +="Please see details below for 10 incidents only. <br/>";
				outputText_new += "Please see details for incidents in excel sheet.<br/>";
				outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
				console.log("Master Incidents Count For Region=>" + dbQueryResult.length);
				buildExcelSheet(excelFileName, dbQueryResult, 4);
			} else {
				outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> master incidents.<br/>";
				outputText_new += "<table class='w-100'>";
				outputText_new += "<tr><th>INCIDENT NUMBER</th><th>STATUS</th><th>DESCRIPTION</th><th>REGION</th><th>SITE NAME</th></tr>";
				for (i = 0; i < dbQueryResult.length; i++) {
					if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
						break;
					}
					var siteName = S(dbQueryResult[i].SITE_NAME).replaceAll(' ', '').s;
					var fullSummary = dbQueryResult[i].SUMMARY;
					var summary = fullSummary;
					if (fullSummary.length > 30) {
						summary = fullSummary.substr(0, 30) + " ....";
					}
					outputText_new += "<tr><td><a id='" + dbQueryResult[i].INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].INC_STATUS + "</td><td title='" + fullSummary + "'>" + summary + "</td><td>" + dbQueryResult[i].REGION + "</td><td><a id='" + siteName + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].SITE_NAME + "</a></td></tr>";

				}
				outputText_new += "</table><br/>";
			}
		}

		outputText = addFeedbackButton(outputText_new);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[1] = "<b>" + temp + "</b>";
			response.output.text[0] = outputText;
		} else {
			response.output.text[0] = outputText;
		}

		return response.output.text;
	}

	/**
	 * Description
	 * @method showMasterIncidentsForRegion
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} conversationId
	 * @return MemberExpression
	 */
	this.showMasterIncidentsForRegion = function (dbQueryResult, outputText, response, conversationId) {
		var outputText_new = "";

		if (dbQueryResult.length == 0) {
			outputText_new = "<b>There are <b>no</b> master incidents that have child associations</b>.<br/>";
		} else {

			if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
				var excelFileName = "masterIncidentListBasedOnRegion_conv-" + conversationId + "_cnt-" + dbQueryResult.length + "_dt-" + new Date().getTime() + ".xlsx";
				//outputText_new +="Please see details below for 10 incidents only. <br/>";
				outputText_new += "Please see details for incidents in excel sheet.<br/>";
				outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
				console.log("Excel Sheet rows =>" + dbQueryResult.length);
				buildExcelSheet(excelFileName, dbQueryResult, 4);
			} else {
				outputText_new += "Displaying <b>" + dbQueryResult.length + "</b> " + dbQueryResult[0].RELATIONSHIP_TYPE + " incidents that have child association. <br/>";
				outputText_new += "<table class='w-100'>";
				outputText_new += "<tr><th>Child Count</th><th>PARENT INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
				for (i = 0; i < dbQueryResult.length; i++) {
					if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
						break;
					}
					var fullSummary = dbQueryResult[i].SUMMARY;
					var summary = fullSummary;
					if (fullSummary.length > 30) {
						summary = fullSummary.substr(0, 30) + " ....";
					}

					outputText_new += "<tr><td>" + dbQueryResult[i].COUNT + "</td><td><a id='" + dbQueryResult[i].PARENT_INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].PARENT_INCIDENT_NUMBER + "</a></td><td>" + dbQueryResult[i].SUMMARY + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td>" + dbQueryResult[i].SITE_NAME + "</td></tr>";

				}
				outputText_new += "</table><br/>";
			}
		}

		outputText = addFeedbackButton(outputText_new);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[1] = "<b>" + temp + "</b>";
			response.output.text[0] = outputText;
		} else {
			//outputText = outputText_new;
			response.output.text[0] = outputText;
		}
		return response.output.text;
	}

	/**
	 * Description
	 * @method showIncidentsForRegionBasedOnLocation
	 * @param {} dbQueryResult
	 * @param {} outputText
	 * @param {} response
	 * @param {} conversationId
	 * @return MemberExpression
	 */
	this.showIncidentsForRegionBasedOnLocation = function (dbQueryResult, outputText, response, conversationId) {
		var outputText_new = "";
		var excelFileName = "incidentListInRegionBasedOnLocation_" + conversationId + "_" + new Date().getTime() + ".xlsx";
		if (dbQueryResult != null && dbQueryResult.length != 0) {
			outputText_new = "There are total <b>" + dbQueryResult.length + "</b> incidents. ";
		} else {
			outputText_new = "<b>No incident data available in remedy for location " + response.context.cxt_location_name_region_flow + "</b>. <br/><br/>";

		}
		if (dbQueryResult != null && dbQueryResult.length > excelGenerationRecordCountLimit) {
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);
		} else if (dbQueryResult != null && dbQueryResult.length > 0) {
			outputText_new += "Please see details below for <b>" + dbQueryResult.length + "</b> incidents only. <br/>";
			outputText_new += "<table class='w-100'>";
			outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {

				if (i > 10 && dbQueryResult.length > excelGenerationRecordCountLimit) {
					break;
				}
				var siteName = S(dbQueryResult[i].SITE_NAME).replaceAll(' ', '').s;
				var fullSummary = dbQueryResult[i].SUMMARY;
				var summary = fullSummary;
				if (fullSummary.length > 30) {
					summary = fullSummary.substr(0, 30) + " ....";
				}
				outputText_new += "<tr><td><a id='" + dbQueryResult[i].INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td title='"+fullSummary+"'>" + summary + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td><a id='" + siteName + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].SITE_NAME + "</a></td></tr>";

			}
			outputText_new += "</table><br/>";
		}

		outputText_new = addFeedbackButton(outputText_new);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[1] = temp;
			response.output.text[0] = outputText_new;
		} else {
			response.output.text[0] = outputText_new;
		}

		return response.output.text;
	}

	/**
	 * Description
	 * @method showIncidentsForTransmissionFailureOnLocation
	 * @param {} dbQueryResult
	 * @param {} response
	 * @param {} conversationId
	 * @return MemberExpression
	 */
	this.showIncidentsForTransmissionFailureOnLocation = function (dbQueryResult, response, conversationId) {

		var outputText_new = '';
		var excelFileName = "incidentListForTransmissionFailureBasedOnLocation_" + conversationId + "_" + new Date().getTime() + ".xlsx";
		console.log("showIncidentsForTransmissionFailureOnLocation=>resultCount=>" + dbQueryResult.length);
		if (dbQueryResult.length == 0) {
			outputText_new += "There are no master open faults for type <b>" + response.context.cxt_tx_name + "</b> in the selected area <b>" + response.context.cxt_location_name_trx_flow + "</b>. ";

		}
		if (dbQueryResult.length > 0 && dbQueryResult.length > excelGenerationRecordCountLimit) {
			outputText_new += "Please see details for incidents in excel sheet.<br/>";
			outputText_new += "<button onClick=openExcelDownloadWindow('" + excelFileName + "')>Download Excel</button><br/>";
			buildExcelSheet(excelFileName, dbQueryResult, 4);

		} else if (dbQueryResult.length > 0) {
			outputText_new += "There are total <b>" + dbQueryResult.length + "</b> master incidents for technology type " + response.context.cxt_tx_name + ". ";
			outputText_new += "<table class='w-100'>";
			outputText_new += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
			for (i = 0; i < dbQueryResult.length; i++) {
				var siteName = S(dbQueryResult[i].SITE_NAME).replaceAll(' ', '').s;
				var fullSummary = dbQueryResult[i].SUMMARY;
				var summary = fullSummary;
				if (fullSummary.length > 30) {
					summary = fullSummary.substr(0, 30) + " ....";
				}
				outputText_new += "<tr><td><a id='" + dbQueryResult[i].INCIDENT_NUMBER + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].INCIDENT_NUMBER + "</a></td><td title='"+fullSummary+"'>" + summary + "</td><td>" + dbQueryResult[i].INC_STATUS + "</td><td><a id='" + siteName + "' href='#' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + dbQueryResult[i].SITE_NAME + "</a></td></tr>";

			}
			outputText_new += "</table><br/>";
		}



		outputText_new = addFeedbackButton(outputText_new);
		if (response.output.text[0] != null) {
			var temp = response.output.text[0];
			response.output.text[1] = temp;
			response.output.text[0] = outputText_new;
		}
		console.log("response.output.text=>" + response.output.text);
		return response.output.text;

	}

	/**
	 * Description
	 * @method orchestrateBotResponseTextForCustomer
	 * @param {} customerCount
	 * @param {} data
	 * @param {} regionName
	 * @return data
	 */
	this.orchestrateBotResponseTextForCustomer = function (customerCount, data, regionName) {
		outputText = data.output.text;
		data.context.cxt_matched_customer_count = customerCount;
		if (customerCount > 0) {
			console.log("orchestrateBotResponseTextForCustomer = >Length of rows =>" + customerCount);
			outputText = S(outputText).replaceAll('[no_of_customers]', "<b>" + customerCount + "</b>").s;
			outputText = S(outputText).replaceAll('[region_name]', "<b>" + regionName + "</b>").s;

		} else {
			if (regionName != null)
				outputText = "<br/><b>Sorry no result found for specified customer in " + regionName + ".<br/><br/> Reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a> to search again.</b>";
			else
				outputText = "<br/><b>Sorry no result found for specified customer <br/><br/> Reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a> to search again.</b>";

			data.context.cxt_customer_flow_found = false;
			data.context.cxt_unknown_input = null;
			data.context.cxt_matched_customer_list = null;
			data.context.cxt_customer_input_text = null;
		}

		if (data.output != null && data.output.text != null) {

			data.output.text = outputText;
		}

		return data;

	}

	/**
	 * Description
	 * @method orchestrateBotResponseTextForTransmissionFailures
	 * @param {} response
	 * @param {} sync
	 * @return response
	 */
	this.orchestrateBotResponseTextForTransmissionFailures = function (response, sync) {

		console.log("orchestrateBotResponseTextForTransmissionFailures");
		var masterIncidentCount = 0;
		var childIncidentCount = 0;
		var outputText_new = '';
		//if (dbQueryResult != null) {
		var connection = getOracleDBConnectionRemedy(sync);
		var childIncidentCount = getChildIncidentCountForTechType_SqlHandler(response,sync,connection);
		response.context.cxt_child_incident_count_for_region = childIncidentCount;
		
		var connection = getOracleDBConnectionRemedy(sync);
		masterIncidentCount = getMasterIncidentCountForTechType_SqlHandler(response,sync,connection);
		var totalCount = masterIncidentCount + childIncidentCount;
		response.context.cxt_tx_found_incident_count = totalCount;
		var is_are = "is";
		if (childIncidentCount > 1) {
			is_are = "are";
		}

		outputText = response.output.text[0];
		
		if (totalCount > 0) {

			outputText = S(outputText).replaceAll('[open_incident_count]', "<b>" + totalCount + "</b>").s;
			outputText = S(outputText).replaceAll('[failure_type_name]', "<b>" + cause_tier_1 + "</b>").s;
			outputText = S(outputText).replaceAll('[master_incident_count]', "<b>" + masterIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[child_incident_count]', "<b>" + childIncidentCount + "</b>").s;
			outputText = S(outputText).replaceAll('[is_are]', is_are).s;
			outputText += "<br/>Do you want to further drill down the search? reply with <b<b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>&nbsp; <b><a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >no</a></b></b>.";
		} else {
			outputText = "<br/><b>No</b> incidents found against the given domain <b>" + cause_tier_1 + "</b>. <b>If you want to search anything else reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >yes</a></b>.";
			response = resetEveryThing(response);
			response = getWatsonResponse(response, sync, "yes");

		}


		//}
		// this condition will handle the use case when in flow of intent 4 some one types again transmission failure domain when ask for yes or no.
		if (outputText != null) {
			var pos = outputText.indexOf('exit');
			console.log("pos=>" + pos);
			if (pos > 0) {
				outputText = outputText;
			}
		}
		
		console.log("outputText=>"+outputText);
		response.output.text[0] = outputText;

		return response;
	}

	/**
	 * Description
	 * @method addFeedbackButton
	 * @param {} outputText
	 * @return outputText
	 */
	this.addFeedbackButton = function (outputText) {
		outputText += "<br/><b>Please vote on feedback provided.</b>&nbsp;&nbsp;<img src='img/thumbsup-blue.png' class='feedback-img' title='good' onClick='openWindow(1);' />&nbsp;&nbsp;<img src='img/thumbsdown-red.png' class='feedback-img' title='bad' onClick='LogThumbsDown();' /><br/>";
		//outputText += "<div class='rating'><span onclick='javascript:rate(5);' title='5'>☆</span><span onclick='javascript:rate(4);' title='4'>☆</span><span onclick='javascript:rate(3);' title='3'>☆</span><span onclick='javascript:rate(2);' title='2'>☆</span><span onclick='javascript:rate(1);' title='1'>☆</span></div><br/>";
		return outputText;
	}

	/**
	 * Description
	 * @method buildExcelSheet
	 * @param {} excelSheetName
	 * @param {} dbQueryResult
	 * @param {} noOfColumns
	 * @return 
	 */
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