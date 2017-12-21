module.exports = function () {
    var workspaceId = process.env.WORKSPACE_ID;
    var Conversation = require("watson-developer-cloud/conversation/v1");
    var conversation = new Conversation({
        username: process.env.CONVERSATION_USERNAME,
        password: process.env.CONVERSATION_PASSWORD,
        version_date: '2017-05-26'
    });
    var incidentTableName = "ARADMIN.HPD_HELP_DESK inc";
    var incidentTableName_2 = "ARADMIN.HPD_HELP_DESK inc_2";
    var taskTable = "ARADMIN.TMS_TASK";
    var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,inc.ASSIGNED_GROUP,inc.RESOLUTION_CATEGORY_TIER_2 as RESOLUTION_CATEGORY_TIER_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

    var incidentTableJoinTaskTable = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,tas.ASSIGNEE_GROUP as TASK_ASSIGNEE_GROUP,tas.ASSIGNEE as TASK_ASSIGNEE,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";
    //Handling Intent Logic for Vodacom chat bot
    require('./stringhandler')();
    var S = require('string');
    var striptags = require('striptags');

    this.handleSitesIntent = function (data, inputText, outputText, sync) {
        var isValidSitesIntent = true;
        if (data != null && data.entities != null) {
            for (i = 0; i < data.entities.length; i++) {

                if (data.intents[i] != null && data.intents[i].intent == 'incident') {
                    isValidSitesIntent = false;
                }
            }
        }
        if (data.context.cxt_ci_flow_site_name == null) {
            isValidSitesIntent = false;
        }

        console.log("isValidSitesIntent=>" + isValidSitesIntent);
        if (data.context.cxt_ci_flow_site_name != null && isValidSitesIntent) {
            console.log("handleSitesIntent");
            console.log("data.context.cxt_ci_flow_site_name=>" + data.context.cxt_ci_flow_site_name);
            var lookForSiteNames = "Select ci_name from locations_lookup where LOWER(ci_name) = '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "'";
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
                var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and LOWER(inc.HPD_CI) like '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "%'";
                console.log("incidents on site name=>" + incidentSql);
                //var incidentResult = executeQuerySync(incidentSql);
                var connection = getOracleDBConnectionRemedy(sync);
                var incidentResult = getOracleQueryResult(connection, incidentSql, sync);
                doRelease(connection);
                outputText = showIncidentsForSiteName(incidentResult.rows, outputText, data, data.context.conversation_id);
                data.context.cxt_ci_site_name_found_in_db = false;
                data.context.cxt_ci_flow_site_name = null;
            }
        }
        return outputText;
    }

    this.handleTransmissionFailureIntent = function (data, inputText, outputText, sync) {

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
                /*sql = "Select count(inc.INCIDENT_NUMBER) as incidentCount from "+incidentTableName+" where inc.STATUS in (0,1,2,3) AND LOWER(inc.GENERIC_CATEGORIZATION_TIER_2) = '" + tier_cause_search_term.toLowerCase() + "' ";
                console.log(sql);
                //output = executeQuerySync(sql);
                var connection = getOracleDBConnectionRemedy( sync);
                output = getOracleQueryResult(connection, sql, sync);
                doRelease(connection);*/

                outputText = orchestrateBotResponseTextForTransmissionFailures(null, data.output.text, data, sync);
            }

            /* if (output != null) {
                 if (output.rows != null && output.rows.length > 0) {
 
                     outputText = orchestrateBotResponseTextForTransmissionFailures(output.rows, data.output.text, data,sync);
                 }
                 if (output.rows.length == 0) {
                     //console.log("in not found message.");
                     outputText = "Sorry, <b>no</b> open incidents have been found because of <b>" + tier_cause_search_term + "</b>";
                 }
 
             }*/

        }

        return outputText;

    }

    this.handleCustomerIntent = function (data, inputText, outputText, incidentFlow, sync) {

        var isValidCustomerIntent = false;
        if (data != null && data.entities != null) {
            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && data.entities[i].entity == 'corporate-customers') {
                    isValidCustomerIntent = true;

                }
            }

            if (data.context.cxt_customer_drill_down_region != null) {
                isValidCustomerIntent = true;
            }
        }
        console.log("isValidCustomerIntent=>" + isValidCustomerIntent);
        if (data != null && data.context.cxt_user_selected_customer == null && isValidCustomerIntent) {

            var customerCount = 0;
            var customerList = [];
            var regionName = null;
            var complexCustomerCase = false;
            console.log("data.context.cxt_customer_input_text=>" + data.context.cxt_customer_input_text);
            var customerInputText = data.context.cxt_customer_input_text;
            if (data.entities.length > 0) {

                for (i = 0; i < data.entities.length; i++) {

                    if (data.entities[i] != null && data.entities[i].entity == 'corporate-customers') {
                        if (data.entities[i].value == 'complexCustomer'){
                            complexCustomerCase = true; 
                        }
                        customerList[i] = data.entities[i].value;
                        customerCount++;
                    }
                    if (data.entities[i] != null && data.entities[i].entity == 'regions') {
                        regionName = data.entities[i].value;
                    }
                }
            }


            if (customerCount > 0) {
                data.context.cxt_matched_customer_list = customerList;
            }



            var inOperatorCustomer = '';
            if (customerCount >= 1) {
                console.log("handleCustomerIntent");



                if (customerList.length == 1) {
                    customerInputText = customerList[0];
                }
                for (i = 0; i < customerList.length; i++) {
                    inOperatorCustomer += "'" + customerList[i] + "'";
                    if (i < customerList.length - 1) {
                        inOperatorCustomer += ",";
                    }
                }
                var sql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv";

                if (complexCustomerCase) {
                   
                    sql += " where LOWER(MPLSVPN_NAME) = '" + customerName + "' AND IFACE_VLANID > 0";
                    
                } else {

                    if (customerInputText == null) {
                        sql += " where MPLSVPN_NAME in  (" + inOperatorCustomer + ")  AND IFACE_VLANID > 0 ";
                        data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where MPLSVPN_NAME in  (" + inOperatorCustomer + ") AND IFACE_VLANID > 0";
                    } else {
                        data.context.cxt_customer_input_text = customerInputText;
                        customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query
                        sql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
                        data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
                    }
                }
                // if no complex customer given then we match customer if its in asked question.
                if (regionName != null && data.context.cxt_complex_customer == null) {
                    sql += " AND LOWER(REGION) = '" + regionName.toLowerCase() + "'";
                }

                console.log("customer sql =>" + sql);
                var output = null;
                var connection = getOracleDBConnection(sync);
                output = getOracleQueryResult(connection, sql, sync);
                doRelease(connection);
                if (output != null && output.rows != null) {
                    customerCount = output.rows.length;
                }

                data.context.cxt_customer_query = sql;

                if (customerCount == 1) {
                    data.context.cxt_user_selected_customer = output.rows[0].MPLSVPN_NAME;

                }
                data.context.cxt_matched_customer_count = customerCount;
                outputText = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);
            } else {
                // outputText = "No customer found with the given name.";
            }

        }

        // console.log("data.entities.length=>"+JSON.stringify(data.entities.length));

        if (data != null && data.intents[0].intent == 'corporate-customer' && data.intents[0].confidence < 0.5 && customerCount == 0) {
            // this code is written to handle the shit of Watson API that will not hit any intent in developer interface but when returned
            // in orchestration layer it shows corporate customer intent for unknown input with confidence less than 0.5 not sure why just applying a check to 
            // handle the scenario
            data.context.cxt_customer_input_text = data.input.text;
            data.context.cxt_unknown_customer_case = true;

        }

        if (data != null && data.context.cxt_customer_input_text != null && data.context.cxt_unknown_customer_case) {

            var sql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_v";

            if (data.context.cxt_customer_input_text != null) {
                customerInputText = data.context.cxt_customer_input_text;
            }
            if (data.context.cxt_unknown_input != null) {
                customerInputText = data.context.cxt_unknown_input;
            }

            customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query

            sql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";

            console.log("unknown customer sql =>" + sql);

            var connection = getOracleDBConnection(sync);

            output = getOracleQueryResult(connection, sql, sync);

            doRelease(connection);

            if (output != null && output.rows != null) {

                // add learning code here.
                if (customerInputText != null) {
                    // Adding to watson training.
                    customerInputText = S(customerInputText).replaceAll('%', ' ').s; // replacing % with space for like query
                    console.log("Adding entity=>" + customerInputText);
                    createEntityValue(customerInputText, "corporate-customers");
                }
                customerCount = output.rows.length;
            }
            data.context.cxt_customer_query = sql;
            if (customerCount == 1) {
                // data.context.cxt_user_selected_customer = S(output.rows[0].MPLSVPN_NAME).replaceAll('/', '#').s;
                data.context.cxt_user_selected_customer = output.rows[0].MPLSVPN_NAME;

            }
            data.context.cxt_matched_customer_count = customerCount;
            outputText = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);
            data.context.cxt_customer_input_text = null;
        }
        // handling regiona and customer name case



        return outputText;

    }

    this.handleRegionIntent = function (data, inputText, outputText, sync) {
        var isValidRegionIntentCase = true;
        var regionName = null;
        if (data != null && data.entities != null) {

            if (!data.context.cxt_region_show_isolated_fault && data.context.cxt_location_name_region_flow == null) {
                isValidRegionIntentCase = true;
            } else {
                isValidRegionIntentCase = false;
            }

            if (data.entities.length == 0) {
                isValidRegionIntentCase = false;
            }

            for (i = 0; i < data.entities.length; i++) {
                if (data.entities[i].entity == 'escalation' || data.entities[i].entity == "corporate-customers" || data.entities[i].entity == "2g-sites") {
                    isValidRegionIntentCase = false;
                }
                if (data.entities[i].entity == 'regions' || data.entities[i].entity == "sys-location") {
                    regionName = data.entities[i].value;
                    isValidRegionIntentCase = true;
                } else {
                    isValidRegionIntentCase = false;
                }

            }
        }



        console.log("region name =>" + regionName);
        console.log("isValidRegionIntentCase =>" + isValidRegionIntentCase);
        console.log("data.context.cxt_matched_customer_count =>" + data.context.cxt_matched_customer_count);

        if (data != null && data.entities != null && isValidRegionIntentCase && regionName != null && data.context.cxt_customer_drill_down_region == null) {

            /*  if (data.entities != null && data.entities.length <= 3
  
                  && ((data.entities[0] != null && data.entities[0].entity == "regions") || (data.entities[1] != null && data.entities[1].entity == "regions") || (data.entities[0] != null && data.entities[0].entity == "sys-location" || data.entities[1] != null && data.entities[1].entity == "sys-location"))
  
              ) {*/
            console.log("handleRegionIntent");
            data.context.cxt_region_name = regionName;
            var fullName = "";

            var regionLookupQuery = "Select * from region_lookup where (LOWER(abbreviation) = '" + regionName.toLowerCase() + "' OR LOWER(full_name) = '" + regionName.toLowerCase() + "')";
            console.log("lookup query =>" + regionLookupQuery);
            var lookupResult = executeQuerySync(regionLookupQuery);
            if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
                regionName = lookupResult.data.rows[0].full_name;
            }
            data.context.cxt_region_full_name = regionName;
            /* var regionName_2 = S(regionName).replaceAll('Africa', "").s;
             regionName_2 = S(regionName_2).replaceAll('africa', "").s;
             regionName_2 = S(regionName_2).s; */
            outputText = orchestrateBotResponseTextForRegion(null, data.output.text, regionName, data, sync);
        }

        return outputText;

    }

    this.handleIncidentIntent = function (data, inputText, outputText, incidentFlow, sync) {

        var isValidIncidentIntent = false;
        var incidentNumber = false;
        if (data != null && data.entities != null) {

            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && (data.entities[i].entity == 'corporate-customers' || data.entities[i].entity == '2g-sites')) {
                    isValidIncidentIntent = false;
                }
                if (data.intents[i] != null && (data.intents[i].intent == "sites" || data.intents[i].intent == "regions")) {
                    isValidIncidentIntent = false;
                }
                if (data.entities[i] != null && data.entities[i].entity == "incidents") {
                    isValidIncidentIntent = true;
                }
                if (data.intents[i] != null && data.intents[i].intent == "incident" && data.intents[i].confidence > 0.5) {
                    isValidIncidentIntent = true;
                }
                if (data.entities[i].entity == 'sys-number') {
                    console.log("incident number matched by entity");
                    incidentNumber = data.entities[i].value;
                }

            }
            if (inputText != null) {
                regexTest = inputText.match(/[incINC]*([0-9])+/i);
                if (regexTest != null) {
                    console.log("incident number matched by regular expression");
                    incidentNumber = regexTest[0];
                }
            }
            console.log("incidentNumber=>" + JSON.stringify(incidentNumber));
            if (incidentNumber && data.context.cxt_location_name_trx_flow == null && data.context.cxt_tx_name == null && data.context.cxt_region_name == null && data.context.cxt_matched_customer_count == 0 && data.context.cxt_ci_flow_site_name == null) {
                isValidIncidentIntent = true;
            } else {
                isValidIncidentIntent = false;
            }


        }


        console.log("isValidIncidentIntent=>" + isValidIncidentIntent);


        if (isValidIncidentIntent) {

            console.log("handleIncidentIntent");
            console.log("incidentNumber=>" + JSON.stringify(incidentNumber));
            incidentFlow = true;
            if (incidentNumber) {
                var incident_no_str = incidentNumber.toUpperCase();
                incidentNumber = correctIncidentNumberFormat(incident_no_str);

                var sql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                var connection = getOracleDBConnectionRemedy(sync);
                var output = getOracleQueryResult(connection, sql, sync);
                doRelease(connection);
                if (output != null && output.rows != null && output.rows.length > 0) {
                    console.log("found incident");
                    var childsql = "Select count(*) as CHILD_COUNT from " + incidentTableName + " where inc.STATUS in (0,1,2,3)  and inc.ORIGINAL_INCIDENT_NUMBER  = '" + incidentNumber + "'";
                    console.log("child incident count query =>" + childsql);
                    var connection = getOracleDBConnectionRemedy(sync);
                    var childoutput = getOracleQueryResult(connection, childsql, sync);
                    doRelease(connection);
                    var childCount = 0;
                    if (childoutput != null && childoutput.rows != null) {
                        console.log("child count for incident =>" + childoutput.rows[0].CHILD_COUNT);
                        childCount = childoutput.rows[0].CHILD_COUNT;
                    }
                    outputText = orchestrateBotResponseTextForIncident(output.rows, data.output.text, data, childCount);
                } else {
                    outputText = "<b>Sorry, no result can be found against given incident number " + incidentNumber + " in remedy. Please provide with a different incident number.</b>";
                }
            } else {

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
            regexTest = inputText.match(/[nodeNODE]+([0-9])+/i);
            if (regexTest != null) {
                outputText = "<b>This seems to be a Node name, i am not trained to look for node names. If you are asking about a site , please provide site name.</b>";
            }

            regexTest = inputText.match(/[trunkTRUNK]+([0-9])+/i);
            if (regexTest != null) {
                outputText = "<b>This seems to be a Trunk name, i am not trained to look for trunk names. If you are asking about a site , please provide site name.</b>";
            }

        }
        return outputText;
    }

    this.handleEscalationIntent = function (data, inputText, outputText, await, defer, discovery) {

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

    function createEntityValue(val, entityName) {
        var params = {
            workspace_id: workspaceId,
            entity: entityName,
            value: val
        };

        conversation.createValue(params, function (err, response) {
            if (err) {
                console.error(err);
            } else {
                console.log(JSON.stringify(response, null, 2));
                var res = val.split(" ");
                for (i = 0; i < res.length; i++) {
                    createSynonymsForValue(val, entityName, res[i]);
                }
            }

        });


    }

    function createSynonymsForValue(val, entityName, synonymVal) {
        var params = {
            workspace_id: workspaceId,
            entity: entityName,
            value: val,
            synonym: synonymVal
        };
        conversation.createSynonym(params, function (err, response) {
            if (err) {
                console.error(err);
            } else {
                console.log(JSON.stringify(response, null, 2));
            }

        });
    }



};
