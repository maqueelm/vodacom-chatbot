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
        var siteNodePattern = false;
        var siteNamePattern = false;
        if (data != null && data.entities != null) {
            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && data.entities[i].entity == 'sites-node-pattern') {
                    siteNodePattern = true;
                }
                if (data.entities[i] != null && data.entities[i].entity == 'site-names-pattern') {
                    siteNamePattern = true;
                }
            }
            /*for (i = 0; i < data.intents.length; i++) {

                if (data.intents[i] != null && data.intents[i].intent == 'incident') {
                    isValidSitesIntent = false;
                }

            }*/
        }
        if (data.context.cxt_ci_flow_site_name == null) {
            isValidSitesIntent = false;
        }

        console.log("isValidSitesIntent=>" + isValidSitesIntent);
        if (data.context.cxt_ci_flow_site_name != null && isValidSitesIntent) {
            console.log("handleSitesIntent");
            console.log("data.context.cxt_ci_flow_site_name=>" + data.context.cxt_ci_flow_site_name);
            var lookForSiteNames = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(CI_NAME) = '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "'";
            console.log("SiteName Query=>" + lookForSiteNames);
            //var lookForSiteNamesData = executeQuerySync(lookForSiteNames);
            var connection = getOracleDBConnection(sync);
            if (connection) {
                var lookForSiteNamesData = getOracleQueryResult(connection, lookForSiteNames, sync);
                doRelease(connection);

                if (lookForSiteNamesData != null && lookForSiteNamesData.rows.length > 0) {
                    // look for incident based on the site.
                    console.log("site name found in db");
                    data.context.cxt_ci_site_name_found_in_db = true;
                    console.log("siteNodePattern=>" + siteNodePattern);
                    if (siteNodePattern || siteNamePattern) {
                        // add this node in watson learning for sitenames
                        console.log("Adding to 2g-sites entity=>" + data.context.cxt_ci_flow_site_name);
                        createEntityValue(data.context.cxt_ci_flow_site_name, "2g-sites");
                    }

                } else {
                    // site name not found
                    console.log("site name not found in db");
                    data.context.cxt_ci_site_name_found_in_db = false;
                    data.output.text = "Site name <b>not</b> found. Would you like to do another search? Reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >Yes</a> </b>.";
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
                    data.output.text = showIncidentsForSiteName(incidentResult.rows, outputText, data, data.context.conversation_id);
                    data.context.cxt_ci_site_name_found_in_db = false;
                    data.context.cxt_ci_flow_site_name = null;
                }
            } else {
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }
        }
        return data.output.text;
    }

    this.handleTransmissionFailureIntent = function (data, inputText, outputText, sync) {

        if (data != null && data.intents[0] != null && data.intents[0].intent == "tier-cause-transmission-failure" || (data != null && data.entities[0] != null && data.entities[0].entity == "transmission-failures")) {



            //console.log(JSON.stringify(data));
            var tier_cause_search_term = null;
            var output = null;
            var sql = null;
            var validTransmissionFailureIntent = false;
            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && data.entities[i].entity == 'transmission-failures') {
                    tier_cause_search_term = data.entities[i].value;
                    validTransmissionFailureIntent = true;
                }
            }

            if (data.context.cxt_matched_customer_count > 0) {
                validTransmissionFailureIntent = false;
            }


            if (validTransmissionFailureIntent) {
                console.log("handleTransmissionFailureIntent");
                data.context.cxt_tx_name = tier_cause_search_term;

                if (tier_cause_search_term != null) {

                    data.context.cxt_tx_name = tier_cause_search_term;
                    var locatoinForFailureSql = "Select distinct inc.HPD_CI as SITE_NAME from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3))";
                    locatoinForFailureSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                    // var locatoinForFailureSql = "Select inc.HPD_CI as SITE_NAME from " + incidentTableName + " where inc.STATUS in (0,1,2,3) ";
                    if (tier_cause_search_term.toLowerCase() == 'transmission') {
                        locatoinForFailureSql += " and LOWER(inc.GENERIC_CATEGORIZATION_TIER_1) in ('transport tx','transport','transport cdn nsa 3rd party','transport cdn 3rd party','transport cdn','transport tx 3rd party','transport_tx')";
                    } else {
                        locatoinForFailureSql += " and LOWER(inc.GENERIC_CATEGORIZATION_TIER_1) = '" + tier_cause_search_term.toLowerCase() + "'";
                    }

                    if (data.context.cxt_tech_type_region != null) {

                        var regionLookupQuery = "Select * from region_lookup where (LOWER(abbreviation) = '" + data.context.cxt_tech_type_region.toLowerCase() + "' OR LOWER(full_name) = '" + data.context.cxt_tech_type_region.toLowerCase() + "')";
                        console.log("lookup query =>" + regionLookupQuery);
                        var lookupResult = executeQuerySync(regionLookupQuery);
                        var regionFullName = '';
                        if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
                            regionFullName = lookupResult.data.rows[0].full_name;
                        }

                        locatoinForFailureSql += " and LOWER(inc.region) = '" + regionFullName.toLowerCase() + "'";
                    }

                    // locatoinForFailureSql += " and rownum < 999";


                    console.log("locatoinForFailureSql=>" + locatoinForFailureSql);
                    //output = executeQuerySync(sql);
                    var connection = getOracleDBConnectionRemedy(sync);
                    if (connection) {
                        var locationForFailureoutput = getOracleQueryResult(connection, locatoinForFailureSql, sync);
                        doRelease(connection);

                        if (locationForFailureoutput != null && locationForFailureoutput.rows.length > 0) {
                            console.log("locationForFailureoutput.rows.length =>" + locationForFailureoutput.rows.length);
                            var inOperator = "(";
                            for (i = 0; i < locationForFailureoutput.rows.length; i++) {

                                inOperator += "'" + locationForFailureoutput.rows[i].SITE_NAME + "'";

                                if (i < locationForFailureoutput.rows.length - 1) {
                                    inOperator += ",";
                                }


                            }
                            inOperator += ")";
                            var locationSql = "SELECT DISTINCT LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE CI_NAME IN " + inOperator + " and LOWER(LOCATION_NAME) != 'unknown' and LOWER(LOCATION_NAME) not like 'estimated%'";
                            if (data.context.cxt_tech_type_region != null) {
                                locationSql += " and LOWER(region) = '" + data.context.cxt_tech_type_region.toLowerCase() + "'";
                            }
                            data.context.cxt_location_list_trx_failure_query = locationSql;
                            //console.log("data.context.cxt_location_list_trx_failure=>" + data.context.cxt_location_list_trx_failure);

                        }


                        data.output.text = orchestrateBotResponseTextForTransmissionFailures(null, data.output.text, data, sync);
                    } else {
                        data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                    }
                }

            }



        }

        return data.output.text;

    }

    this.handleCustomerIntent = function (data, inputText, outputText, incidentFlow, sync) {

        var isValidCustomerIntent = false;
        var customerCount = 0;
        var customerList = [];
        var regionName = null;
        var inOperatorCustomer = '';
        var complexCustomerName = null;
        var complexCustomerNameByPattern = null;
        var complexCustomerNameByPatternList = [];
        if (data != null && data.entities != null) {
            if (data.entities.length > 0) {
                for (i = 0; i < data.entities.length; i++) {

                    if (data.entities[i] != null && data.entities[i].entity == 'corporate-customers' || data.entities[i].entity == 'complex-corporate-customers' || data.entities[i].entity == 'complex-customers-patterns') {
                        isValidCustomerIntent = true;
                        customerList[i] = data.entities[i].value;
                        inOperatorCustomer += "'" + customerList[i] + "'";
                        if (i < data.entities.length - 1) {
                            inOperatorCustomer += ",";
                        }
                        customerCount++;

                    }

                    if (data.entities[i] != null && data.entities[i].entity == 'complex-customers-patterns') {
                        complexCustomerNameByPatternList[i] = data.entities[i].value;
                    }
                    if (data.entities[i] != null && data.entities[i].entity == 'startoverchat') {
                        isValidCustomerIntent = false;
                    }

                }
            }

            if (data.context.cxt_customer_drill_down_region != null) {
                isValidCustomerIntent = true;
                regionName = data.context.cxt_customer_drill_down_region;
            }
            if (data.context.cxt_location_list_trx_failure_query != null) {
                isValidCustomerIntent = false;
            }
        }
        console.log("isValidCustomerIntent=>" + isValidCustomerIntent);
        if (data != null && data.context.cxt_user_selected_customer == null && isValidCustomerIntent && customerCount > 0) {

            console.log("\nhandleCustomerIntent\n");
            console.log("\ndata.context.cxt_customer_input_text=>" + data.context.cxt_customer_input_text);

            var customerInputText = data.context.cxt_customer_input_text;

            var customerSql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv";

            /* if (data.context.cxt_complex_customer_case) {
                 console.log("\nCustomer detected by @complex-corporate-customers.\n");
                 console.log("\ndata.context.cxt_complex_customer=>" + data.context.cxt_complex_customer);
                 //customerSql += " where LOWER(MPLSVPN_NAME) = '" + data.context.cxt_complex_customer + "' AND IFACE_VLANID > 0";
                 console.log("\nSetting Customer Count to 1=>" + data.context.cxt_matched_customer_count);
                 data.context.cxt_matched_customer_count = 1;
             }*/
            if (data.context.cxt_plain_customer_name_case) {

                console.log("\nCustomer detected by @corporate-customer entity only.\n");
                console.log("\ndata.context.cxt_customer_input_text=>" + data.context.cxt_customer_input_text);
                if (customerCount == 1) {
                    customerInputText = data.context.cxt_customer_input_text;
                }
                if (customerInputText == null) {
                    customerSql += " where MPLSVPN_NAME in  (" + inOperatorCustomer + ")  AND IFACE_VLANID > 0 ";
                    data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where MPLSVPN_NAME in  (" + inOperatorCustomer + ") AND IFACE_VLANID > 0";
                } else {
                    data.context.cxt_customer_input_text = customerInputText;
                    customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query
                    customerSql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
                    data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
                }
            }

            if (data.context.cxt_complex_customer_pattern_case && !data.context.cxt_complex_customer_case && !data.context.cxt_plain_customer_name_case) {
                /* handle here when customer name matches only pattern and nothing else. Things to do there
                  1. Get the name that we have from pattern matching.
                  2. confirm if this name is in database using like operator % on end of the string only.
                  3. call watson training code to train watson about this customer and add this customer in  @complex-corporate-customers 
                */
                console.log("\nCustomer detected by @complex-customers-patterns.\n");
                console.log("\ndata.context.cxt_complex_customer_by_pattern=>" + data.context.cxt_complex_customer_by_pattern);
                if (complexCustomerNameByPatternList.length > 1) {
                    data.context.cxt_user_selected_customer = getCorrectComplexCustomerNameFromPatternMatching(complexCustomerNameByPatternList);
                } else {
                    data.context.cxt_user_selected_customer = complexCustomerNameByPatternList[0];
                }
                // after getting one customer out of multiple customers returned by pattern matching, this customer will be verified again from DB before running query for node run.
                var customerPatternSql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv where LOWER(MPLSVPN_NAME) like '" + data.context.cxt_user_selected_customer + "%' AND IFACE_VLANID > 0";
                var complexPatternOutput = null;
                var connection = getOracleDBConnection(sync);
                if (connection) {
                    complexPatternOutput = getOracleQueryResult(connection, customerPatternSql, sync);
                    doRelease(connection);

                    if (complexPatternOutput != null && complexPatternOutput.rows != null) {

                        if (complexPatternOutput.rows.length == 1) {
                            data.context.cxt_user_selected_customer = complexPatternOutput.rows[0].MPLSVPN_NAME;
                        } else if (complexPatternOutput.rows.length > 1) {
                            var dbMatchedCustomerList = [];
                            for (i = 0; i < complexPatternOutput.rows.length; i++) {
                                dbMatchedCustomerList = complexPatternOutput.rows[0].MPLSVPN_NAME;
                            }
                            data.context.cxt_user_selected_customer = getCorrectComplexCustomerNameFromPatternMatching(dbMatchedCustomerList);
                        }
                        // once confirmed from db it will be added into watson training so next time watson will know about this customer and will not confirm again from db.
                        if (data.context.cxt_user_selected_customer != null) {
                            createEntityValue(customerInputText, "complex-corporate-customers");
                        }
                    }
                } else {
                    // database could not be connected.
                    data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                }



            }

            if (regionName != null && !data.context.cxt_complex_customer_case && !data.context.cxt_complex_customer_pattern_case) {
                customerSql += " AND LOWER(REGION) = '" + regionName.toLowerCase() + "'";
            }

            if (data.context.cxt_plain_customer_name_case) {

                console.log("corporate customer customerSql =>" + customerSql);

                var output = null;
                var connection = getOracleDBConnection(sync);
                if (connection) {

                    output = getOracleQueryResult(connection, customerSql, sync);
                    doRelease(connection);

                    if (output != null && output.rows != null) {
                        customerCount = output.rows.length;
                    }

                    data.context.cxt_customer_query = customerSql;
                    data.context.cxt_matched_customer_count = customerCount;

                    if (customerCount == 1) {
                        data.context.cxt_user_selected_customer = output.rows[0].MPLSVPN_NAME;
                    }
                    data.output.text = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);


                } else {
                    data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                }

            }


        }

        if (data != null && data.intents!=null && data.intents[0].intent == 'corporate-customer' && data.intents[0].confidence < 0.5 && customerCount == 0) {
            // this code is written to handle the shit of Watson API that will not hit any intent in developer interface but when returned
            // in orchestration layer it shows corporate customer intent for unknown input with confidence less than 0.5 not sure why just applying a check to 
            // handle the scenario
            data.context.cxt_customer_input_text = data.input.text;
            data.context.cxt_unknown_customer_case = true;

        }

        if (data != null && data.context.cxt_customer_input_text != null && data.context.cxt_location_list_trx_failure_query == null && data.context.cxt_unknown_customer_case && !data.context.cxt_plain_customer_name_case && data.context.cxt_user_selected_customer == null) {

            var sql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_v";

            if (data.context.cxt_customer_input_text != null) {
                customerInputText = data.context.cxt_customer_input_text;
            }
            if (data.context.cxt_unknown_input != null) {
                customerInputText = data.context.cxt_unknown_input;
            }

            customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query

            sql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
            data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
            console.log("unknown customer sql =>" + sql);

            var connection = getOracleDBConnection(sync);
            if (connection) {

                output = getOracleQueryResult(connection, sql, sync);

                doRelease(connection);

                if (output != null && output.rows != null && output.rows.length > 0) {

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
                data.output.text = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);
                data.context.cxt_customer_input_text = null;

            } else {
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";


            }

        }
        // handling regiona and customer name case



        return data.output.text;

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
                if (data.entities[i].entity == 'escalation' || data.entities[i].entity == "2g-sites") {
                    isValidRegionIntentCase = false;
                    break;
                }
                if (data.entities[i].entity == "complex-customers-patterns" || data.entities[i].entity == "complex-corporate-customers" || data.entities[i].entity == "corporate-customers") {
                    isValidRegionIntentCase = false;
                    break;
                }
                if (data.entities[i].entity == 'regions' || data.entities[i].entity == "sys-location") {
                    regionName = data.entities[i].value;
                    isValidRegionIntentCase = true;
                } else {
                    isValidRegionIntentCase = false;
                }
                if (data.entities[i].entity == "transmission-failures") {
                    isValidRegionIntentCase = false;
                    break;
                }

            }

            if (data.context.cxt_unknown_customer_case != null) {
                isValidRegionIntentCase = false;
            }
            if (data.context.cxt_location_list_trx_failure_query != null) {
                isValidRegionIntentCase = false;
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
            data.output.text = orchestrateBotResponseTextForRegion(null, data.output.text, regionName, data, sync);
        }

        return data.output.text;

    }

    this.handleIncidentIntent = function (data, inputText, incidentFlow, sync) {

        var isValidIncidentIntent = false;
        var incidentNumber = false;
        var customerNameDetected = false;
        if (data != null && data.entities != null) {

            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && (data.entities[i].entity == 'complex-customers-patterns' || data.entities[i].entity == 'complex-corporate-customers' || data.entities[i].entity == 'corporate-customers' || data.entities[i].entity == '2g-sites')) {
                    isValidIncidentIntent = false;
                    customerNameDetected = true;
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
                if (data.entities[i] != null && data.entities[i].entity == "sites-node-pattern") {
                    isValidIncidentIntent = false;
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

            if (customerNameDetected || data.context.cxt_site_flow_found) {
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
                var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                //"(SELECT * FROM (SELECT incident_number, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where incident_number = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.incident_number = B.incident_number";

                console.log("Inciddent SQL=>" + sql);
                var connection = getOracleDBConnectionRemedy(sync);
                if (connection) {

                    var output = getOracleQueryResult(connection, sql, sync);
                    console.log("output.rows.length=>" + JSON.stringify(output.rows.length));
                    console.log("output.rows=>" + JSON.stringify(output.rows));
                    if (output!=null  && output.rows!=null && output.rows.length>0 && output.rows[0].RELATIONSHIP_TYPE != "Child") {
                        console.log("incident is not child incident");
                        var sql = "SELECT * from (SELECT " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and tas.status != '6000' and inc.INCIDENT_NUMBER  = '" + incidentNumber + "') A left join" +
                            "(SELECT * FROM (SELECT incident_number, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where incident_number = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.incident_number = B.incident_number";
                        output = getOracleQueryResult(connection, sql, sync);
                        if (output.rows.length == 0) {
                            var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                            // "(SELECT * FROM (SELECT incident_number, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where incident_number = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.incident_number = B.incident_number";
                            output = getOracleQueryResult(connection, sql, sync);
                        }
                    } else {
                        console.log("incident is child incident");
                        var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                        // "(SELECT * FROM (SELECT incident_number, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where incident_number = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.incident_number = B.incident_number";
                        output = getOracleQueryResult(connection, sql, sync);

                    }

                    doRelease(connection);
                    if (output != null && output.rows != null && output.rows.length > 0) {
                        console.log("found incident");
                        var childsql = "Select count(*) as CHILD_COUNT from " + incidentTableName + " where inc.STATUS in (0,1,2,3)  and inc.ORIGINAL_INCIDENT_NUMBER  = '" + incidentNumber + "' and inc.INCIDENT_ASSOCIATION_TYPE = 1";
                        console.log("child incident count query =>" + childsql);
                        var connection = getOracleDBConnectionRemedy(sync);
                        var childoutput = getOracleQueryResult(connection, childsql, sync);
                        doRelease(connection);
                        var childCount = 0;
                        if (childoutput != null && childoutput.rows != null) {
                            console.log("child count for incident =>" + childoutput.rows[0].CHILD_COUNT);
                            childCount = childoutput.rows[0].CHILD_COUNT;
                        }
                        data.output.text = orchestrateBotResponseTextForIncident(output.rows, data.output.text, data, childCount);

                    } else {

                        //data = resetIncidentContext(data);
                        data = resetEveryThing(data);
                        data.output.text = "<b>Sorry, no result can be found against given incident number " + incidentNumber + " in remedy. Please provide with a different incident number.</b>";


                    }

                } else {
                    data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";

                }

            } else {

                data.output.text = "Yes sure, please provide me with the incident number.";
            }
            // handling the case for problems,change requests and tasks.
            //console.log("testing problem change and task =>");
            regexTest = inputText.match(/PBI[0-9]+/i);
            if (regexTest != null) {
                data.output.text = "<b>I am only trained to search Incidents, I cannot search problem refs.</b>";
            }
            regexTest = inputText.match(/CRQ[0-9]+/i);
            if (regexTest != null) {
                data.output.text = "<b>I am only trained to search Incidents, I cannot search change refs.</b>";
            }
            regexTest = inputText.match(/CR[0-9]+/i);
            if (regexTest != null) {
                data.output.text = "<b>I am only trained to search Incidents, I cannot search change refs.</b>";

            }
            regexTest = inputText.match(/TAS[0-9]+/i);
            if (regexTest != null) {
                data.output.text = "<b>I am only trained to search Incidents, I cannot search Task refs.</b>";
            }
            regexTest = inputText.match(/[nodeNODE]+([0-9])+/i);
            if (regexTest != null) {
                data.output.text = "<b>This seems to be a Node name, i am not trained to look for node names. If you are asking about a site , please provide site name.</b>";
            }

            regexTest = inputText.match(/[trunkTRUNK]+([0-9])+/i);
            if (regexTest != null) {
                data.output.text = "<b>This seems to be a Trunk name, i am not trained to look for trunk names. If you are asking about a site , please provide site name.</b>";
            }

        }
        //console.log("no result found for incident=>"+ JSON.stringify(data));
        return data.output.text;
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

    this.createEntityValue = function (val, entityName) {
        createEntityValue(val, entityName);
    }

    function createEntityValue(val, entityName) {
        val = S(val).replaceAll('corporate', '').s;
        val = S(val).replaceAll('customer', '').s;
        if (val != '') {
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
