module.exports = function () {

    var incidentTableName = "VODACOM.HPD_HELP_DESK inc";
    var incidentTableName_2 = "VODACOM.HPD_HELP_DESK inc_2";
    var taskTable = "VODACOM.TMS_TASK";
    var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as parent_incident_number,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as incident_event_start_time,"+
                                        "TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as incident_event_end_time, "+
                                        "inc.SPE_FLD_ACTUALIMPACT as impact,inc.REGION,inc.HPD_CI as site_name,inc.DESCRIPTION as summary,decode(inc.status,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.status) as INC_STATUS,inc.ASSIGNED_GROUP as assigned_group,"+
                                        "inc.ASSIGNEE,inc.ASSIGNEE_GROUP as task_assignee_group,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,"+
                                        "inc.RESOLUTION_CATEGORY_TIER_3 as resolution_category_tier_3,inc.GENERIC_CATEGORIZATION_TIER_1 as cause_tier_1,inc.GENERIC_CATEGORIZATION_TIER_2 as cause_tier_2 ";
    
    var incidentTableJoinTaskTable   = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as parent_incident_number,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as incident_event_start_time,"+
                                        "TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as incident_event_end_time, "+
                                        "inc.SPE_FLD_ACTUALIMPACT as impact,inc.REGION,inc.HPD_CI as site_name,inc.DESCRIPTION as summary,decode(inc.status,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.status) as INC_STATUS,"+
                                        "tas.ASSIGNEE_GROUP as task_assignee_group,tas.ASSIGNEE as task_assignee,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,"+
                                        "inc.RESOLUTION_CATEGORY_TIER_3 as resolution_category_tier_3,inc.GENERIC_CATEGORIZATION_TIER_1 as cause_tier_1,inc.GENERIC_CATEGORIZATION_TIER_2 as cause_tier_2 ";                                    
    //Handling Intent Logic for Vodacom chat bot
    
    var S = require('string');
    var striptags = require('striptags');
    this.handleSitesIntent = function (data, inputText, outputText,sync) {
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
                var incidentSql = "Select "+incidentTableFieldsWithAlias+" from "+incidentTableName+" where inc.HPD_CI like '%" + data.context.cxt_ci_flow_site_name + "%'";
                //var incidentResult = executeQuerySync(incidentSql);
                var connection = getOracleDBConnectionRemedy( sync);
                var output = getOracleQueryResult(connection, incidentSql, sync);
                doRelease(connection);
                outputText = showIncidentsForSiteName(incidentResult.rows, outputText, data, conversationId);
                data.context.cxt_ci_site_name_found_in_db = false;
                data.context.cxt_ci_flow_site_name = null;
            }
        }
        return outputText;
    }

    this.handleTransmissionFailureIntent = function (data, inputText, outputText,sync) {

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
                sql = "Select distinct "+incidentTableFieldsWithAlias+",count(*) as incidentCount from "+incidentTableName+" where inc.GENERIC_CATEGORIZATION_TIER_1 like '" + tier_cause_search_term + "' and inc.STATUS not in (5,6);";
                console.log(sql);
                //output = executeQuerySync(sql);
                var connection = getOracleDBConnectionRemedy( sync);
                output = getOracleQueryResult(connection, sql, sync);
                doRelease(connection);
            }

            if (output != null) {
                if (output.rows != null && output.rows.length > 0) {

                    outputText = orchestrateBotResponseTextForTransmissionFailures(output.rows, data.output.text, data);
                }
                if (output.data.rows.length == 0) {
                    //console.log("in not found message.");
                    outputText = "Sorry, <b>no</b> open incidents have been found because of <b>" + tier_cause_search_term + "</b>";
                }

            }

        }

        return outputText;

    }

    this.handleCustomerIntent = function (data, inputText, outputText, incidentFlow, sync) {

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

                    var sql = "Select * from  telllabes_ods.ebu_vlan_status_v where REPLACE(REPLACE(MPLSVPN_NAME, '_', ' '), '-', ' ') like '%" + customerName + "%';";
                    console.log("customer sql =>" + sql);
                    //var output = executeQuerySync(sql);
                    var connection = getOracleDBConnection( sync);
                    var output = getOracleQueryResult(connection, sql, sync);
                    doRelease(connection);
                    outputText = orchestrateBotResponseTextForCustomer(output.rows, data.output.text, customerName, data);

                }
            }

        }

        return outputText;

    }

    this.handleRegionIntent = function (data, inputText, outputText, sync) {

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
                    var sql = "Select distinct(inc.incident_number),count(*) as incidentCount,"+incidentTableFieldsWithAlias+" from "+incidentTableName+" where inc.REGION like '%" + regionName_1 + "%' and inc.STATUS not in (5,6) order by parent_incident_number desc ;";
                    console.log("get incidents details for region =>" + sql);
                    //var output = executeQuerySync(sql);
                    var connection = getOracleDBConnectionRemedy( sync);
                    var output = getOracleQueryResult(connection, sql, sync);
                    doRelease(connection);



                    if (output.data.rows != null && output.data.rows.length >= 1) {
                        outputText = orchestrateBotResponseTextForRegion(output.data.rows, data.output.text, regionName_1, data,sync);
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

    this.handleIncidentIntent = function (data, inputText, outputText, incidentFlow,sync) {

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
                    var sql = "Select "+incidentTableJoinTaskTable+" from "+incidentTableName+" join "+taskTable+" tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS not in (5,6) and inc.INCIDENT_NUMBER  like '%" + incidentNumber + "%';";
                    console.log(sql);
                    //var output = executeQuerySync(sql);
                    var connection = getOracleDBConnectionRemedy( sync);
                    var output = getOracleQueryResult(connection, sql, sync);
                    //doRelease(connection);

                    var childsql = "Select count(*) as incidentCount from "+incidentTableName+" where inc.ORIGINAL_INCIDENT_NUMBER  like '%" + incidentNumber + "%';";
                    //var childoutput = executeQuerySync(childsql);
                    var connection = getOracleDBConnectionRemedy( sync);
                    var childoutput = getOracleQueryResult(connection, childsql, sync);
                    var childCount = 0;

                    if (childoutput != null && childoutput.rows != null) {
                        console.log("child count for incident =>" + childoutput.rows[0].incidentCount);
                        childCount = childoutput.rows[0].incidentCount;
                    }
                    //console.log("checking output condition");
                    if (output != null) {
                        //console.log("out put is not null");
                        if (output.rows != null && output.rows.length > 0) {
                            console.log("found incident");
                            outputText = orchestrateBotResponseTextForIncident(output.rows, data.output.text, data, childCount);
                        }
                        if (output.rows.length == 0) {
                            //console.log("in not found message.");
                            outputText = "<b>Sorry, no result can be found against given incident number " + incident_no_str + ". Please provide with a different incident number.</b>";
                        } else {
                            console.log("incident" + incident_no_str + " found");
                        }

                    } else {
                        //console.log("out put is null");
                        outputText = "<b>Sorry, no result can be found against given incident number " + incident_no_str + " in remedy. Please provide with a different incident number.</b>";
                    }
                } else {
                    //console.log("last else =>");
                    outputText = "Yes sure, please provide me with the incident number.";
                }
                // handling the case for problems,change requests and tasks.
                //console.log("testing problem change and task =>");
                regexTest = inputText.match(/PBI[0-9]+/i);
                if (regexTest != null) {
                    outputText = "<b>I am only trained to search Incidents, I cannot search problem refs.</b>";
                }
                regexTest = inputText.match(/CRQ[0-9]+/i);
                if (regexTest != null) {
                    outputText = "<b>I am only trained to search Incidents, I cannot search change refs.</b>";
                }
                regexTest = inputText.match(/CR[0-9]+/i);
                if (regexTest != null) {
                    outputText = "<b>I am only trained to search Incidents, I cannot search change refs.</b>";

                }
                regexTest = inputText.match(/TAS[0-9]+/i);
                if (regexTest != null) {
                    outputText = "<b>I am only trained to search Incidents, I cannot search Task refs.</b>";
                }

            }

        }

        return outputText;
    }

    this.handleEscalationIntent = function (data, inputText, outputText,await,defer,discovery) {

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


};
