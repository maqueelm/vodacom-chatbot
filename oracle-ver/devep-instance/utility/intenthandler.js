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
    require('./intentclassifier')();
    var S = require('string');
    var striptags = require('striptags');

    this.handleSitesIntent = function (data, inputText, outputText, sync) {

        var returnArray = sitesIntentClassifier(data);
        var isValidSitesIntent = returnArray['isValidSitesIntent'];
        var siteNodePattern = returnArray['siteNodePattern'];
        var siteNamePattern = returnArray['siteNamePattern'];
       

        if (data.context != null && data.context.cxt_ci_flow_site_name != null && isValidSitesIntent) {
            console.log("handleSitesIntent");
            console.log("data.context.cxt_ci_flow_site_name=>" + data.context.cxt_ci_flow_site_name);
            
            //var lookForSiteNames = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(CI_NAME) = '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "'";
            var lookForSiteNames = "SELECT * FROM " + incidentTableName + " WHERE LOWER(HPD_CI) = '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "' AND STATUS in (0,1,2,3)";
            console.log("lookForSiteNames=>"+lookForSiteNames);
            var connection = getOracleDBConnectionRemedy(sync);
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
                    data.output.text = "Site name <b>not</b> found. Would you like to do another search? Reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >Yes</a> </b>.";
                    data = resetEveryThing(data);

                }
                console.log("data.context.cxt_ci_flow_show_incident=>" + data.context.cxt_ci_flow_show_incident);
                if (data.context.cxt_ci_site_name_found_in_db && data.context.cxt_ci_flow_show_incident) {
                    var childCount = 0;
                    var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and LOWER(inc.HPD_CI) like '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "%'";
                    console.log("\n SQL for incidents on site name=>" + incidentSql);
                    var connection = getOracleDBConnectionRemedy(sync);
                    var incidentResult = getOracleQueryResult(connection, incidentSql, sync);
                    doRelease(connection);
                    data = showIncidentsForSiteName(incidentResult.rows, outputText, data, data.context.conversation_id);
                    data = resetEveryThing(data);
                }
            } else {
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }
        }
        return data;
    }

    this.handleTransmissionFailureIntent = function (data, inputText, outputText, sync) {

        var tier_cause_search_term = null;
        var output = null;
        var sql = null;

        var returnArray = techTypeIntentClassifier(data);
        var validTransmissionFailureIntent = returnArray['validTransmissionFailureIntent'];
        var tier_cause_search_term = returnArray['tier_cause_search_term'];
        if (data != null && data.context != null && validTransmissionFailureIntent) {
            console.log("handleTransmissionFailureIntent");
            // data.context.cxt_tx_name = tier_cause_search_term;

            if (tier_cause_search_term != null) {

                data.context.cxt_tx_name = tier_cause_search_term;
                var locatoinForFailureSql = "Select distinct inc.HPD_CI as SITE_NAME from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3))";
                locatoinForFailureSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                // if (tier_cause_search_term.toLowerCase() == 'transmission') {
                //   locatoinForFailureSql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) in ('transport tx','transport','transport cdn nsa 3rd party','transport cdn 3rd party','transport cdn','transport tx 3rd party','transport_tx')";
                // } else {
                locatoinForFailureSql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) = '" + tier_cause_search_term.toLowerCase() + "'";
                // }
                var regionFullName = '';
                if (data.context.cxt_tech_type_region != null) {

                    var regionLookupQuery = "Select * from region_lookup where (LOWER(abbreviation) = '" + data.context.cxt_tech_type_region.toLowerCase() + "' OR LOWER(full_name) = '" + data.context.cxt_tech_type_region.toLowerCase() + "')";
                    console.log("lookup query =>" + regionLookupQuery);
                    var lookupResult = executeQuerySync(regionLookupQuery);

                    if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows.length > 0) {

                        if (lookupResult.data.rows.length == 1) {
                            regionFullName = "'"+lookupResult.data.rows[0].full_name.toLowerCase()+"'";
                        } else {
                            for (i = 0; i < lookupResult.data.rows.length; i++) {

                                regionFullName += "'" + lookupResult.data.rows[i].full_name.toLowerCase() + "'";
        
                                if (i < lookupResult.data.rows.length - 1) {
                                    regionFullName += ",";
                                }
                            }
                        }
                        
                    }

                    console.log("regionFullName=>" + regionFullName);

                    locatoinForFailureSql += " and LOWER(inc.region) IN (" + regionFullName.toLowerCase() + ")";
                    data.context.cxt_tech_type_region_full_name = regionFullName;
                }

                console.log("locatoinForFailureSql=>" + locatoinForFailureSql);
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
                        locationSql += " order by LOCATION_NAME";
                        data.context.cxt_location_list_trx_failure_query = locationSql;
                        

                    }
                    data = orchestrateBotResponseTextForTransmissionFailures(data, sync);
                } else {
                    data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                }
            }

        }
        return data;
    }

    this.handleCustomerIntent = function (data, inputText, outputText, sync) {
        var returnArray = customerIntentClassifier(data);
        isValidCustomerIntent = returnArray['isValidCustomerIntent'];
        regionName = returnArray['regionName'];
        customerCount = returnArray['customerCount'];
        inOperatorCustomer = returnArray['inOperatorCustomer'];
        customerList = returnArray['customerList'];
        complexCustomerNameByPatternList = returnArray['complexCustomerNameByPatternList'];

        if (data != null && data.context != null && data.context.cxt_user_selected_customer == null && isValidCustomerIntent && customerCount > 0) {

            console.log("\nhandleCustomerIntent\n");
            console.log("\ndata.context.cxt_customer_input_text=>" + data.context.cxt_customer_input_text);

            var customerInputText = data.context.cxt_customer_input_text;
            var customerSql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv";

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

            if (data.context != null && data.context.cxt_complex_customer_pattern_case && !data.context.cxt_complex_customer_case && !data.context.cxt_plain_customer_name_case) {
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

            if (regionName != null && data.context != null && !data.context.cxt_complex_customer_case && !data.context.cxt_complex_customer_pattern_case) {
                customerSql += " AND LOWER(REGION) = '" + regionName.toLowerCase() + "'";
            }

            if (data.context != null && data.context.cxt_plain_customer_name_case) {

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
                    data = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);


                } else {
                    data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                }

            }


        }
        data = handleUnknownCustomerIntent(data,sync);

        return data;

    }

    this.handleUnknownCustomerIntent = function (data,sync) {

        
        if (data != null && data.context != null && data.context.cxt_customer_input_text != null && data.context.cxt_location_list_trx_failure_query == null && data.context.cxt_unknown_customer_case && !data.context.cxt_plain_customer_name_case && data.context.cxt_user_selected_customer == null) {
            console.log("handleUnknownCustomerIntent");

            /**
             * If there is any entity coming as yes with unknown corporate customer flow we need to set that as no in order to skip the next steps from executing before 
             * user input yes for coporate customer intent.
             */
            if (data.entities !=null && data.entities[0] != null && data.entities[0].entity == 'yes') {
                data.entities[0].entity = 'No';
            }


            var sql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv";

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

                var output = getOracleQueryResult(connection, sql, sync);

                doRelease(connection);
                console.log("output for unknown=>" + JSON.stringify(output));
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
                data = orchestrateBotResponseTextForCustomer(customerCount, data, regionName);
                data.context.cxt_customer_input_text = null;

            } else {
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }

        }

        if (data != null && data.intents != null && data.intents[0] != null && data.intents[0].intent == 'corporate-customer' && data.intents[0].confidence < 0.5 && customerCount == 0) {
            // this code is written to handle the shit of Watson API that will not hit any intent in developer interface but when returned
            // in orchestration layer it shows corporate customer intent for unknown input with confidence less than 0.5 not sure why just applying a check to 
            // handle the scenario
            data.context.cxt_customer_input_text = data.input.text;
            data.context.cxt_unknown_customer_case = true;

        }

        return data;


    }

    this.handleRegionIntent = function (data, inputText, outputText, sync) {
        var returnArray = regionIntentClassifier(data);
        var isValidRegionIntentCase = returnArray['isValidRegionIntentCase'];
        var regionName = returnArray['regionName'];;
        
        if (isValidRegionIntentCase) {
            var fullName = "";
            var regionLookupQuery = "Select * from region_lookup where (LOWER(abbreviation) = '" + regionName.toLowerCase() + "' OR LOWER(full_name) = '" + regionName.toLowerCase() + "')";
            console.log("region lookup query =>" + regionLookupQuery);
            var regionFullName = '';
            var lookupResult = executeQuerySync(regionLookupQuery);
            if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows.length > 0) {

                if (lookupResult.data.rows.length == 1) {
                    regionFullName = "'" +lookupResult.data.rows[0].full_name.toLowerCase()+ "'";
                } else {
                    regionFullName = '';
                    for (i = 0; i < lookupResult.data.rows.length; i++) {

                        regionFullName += "'" + lookupResult.data.rows[i].full_name.toLowerCase() + "'";

                        if (i < lookupResult.data.rows.length - 1) {
                            regionFullName += ",";
                        }
                    }

                }


            }
            data.context.cxt_region_name = regionName;
            data.context.cxt_region_full_name = regionFullName;
            data = orchestrateBotResponseTextForRegion(data, sync);
        }

        return data;

    }

    this.handleIncidentIntent = function (data, inputText, sync) {

        var returnArray = incidentIntentClassifier(data, inputText);
        var isValidIncidentIntent = returnArray['isValidIncidentIntent'];
        var incidentNumber = returnArray['incidentNumber'];

        if (isValidIncidentIntent && incidentNumber) {

            var incident_no_str = incidentNumber.toUpperCase();
            incidentNumber = correctIncidentNumberFormat(incident_no_str);
            var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
            var connection = getOracleDBConnectionRemedy(sync);
            if (connection) {

                var output = getOracleQueryResult(connection, sql, sync);

                if (output != null && output.rows != null && output.rows.length > 0 && output.rows[0].RELATIONSHIP_TYPE != "Child") {
                    console.log("incident is not child incident");
                    var sql = "SELECT * from (SELECT " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and tas.status != '6000' and inc.INCIDENT_NUMBER  = '" + incidentNumber + "') A left join" +
                        "(SELECT * FROM (SELECT INCIDENT_NUMBER, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where INCIDENT_NUMBER = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.INCIDENT_NUMBER = B.INCIDENT_NUMBER";
                    output = getOracleQueryResult(connection, sql, sync);
                    if (output.rows.length == 0) {
                        var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                        output = getOracleQueryResult(connection, sql, sync);
                    }
                    console.log(" incident is not child incident sql=>" + sql);
                } else {
                    console.log("incident is child incident");
                    var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
                    output = getOracleQueryResult(connection, sql, sync);

                }

                doRelease(connection);
                if (output != null && output.rows != null && output.rows.length > 0) {
                    var childsql = "Select count(*) as CHILD_COUNT from " + incidentTableName + " where inc.STATUS in (0,1,2,3)  and inc.ORIGINAL_INCIDENT_NUMBER  = '" + incidentNumber + "' and inc.INCIDENT_ASSOCIATION_TYPE = 1";
                    var connection = getOracleDBConnectionRemedy(sync);
                    var childoutput = getOracleQueryResult(connection, childsql, sync);
                    doRelease(connection);
                    var childCount = 0;
                    if (childoutput != null && childoutput.rows != null) {
                        childCount = childoutput.rows[0].CHILD_COUNT;
                    }
                    data = orchestrateBotResponseTextForIncident(output.rows, data.output.text, data, childCount, sync);
                } else {
                    data = resetEveryThing(data);
                    data = getWatsonResponse(data, sync);
                    var temp = data.output.text[0];
                    data.output.text[0] = "<b>Sorry, no result can be found against given incident number " + incidentNumber + " in remedy. Please provide with a different incident number.</b>";
                    data.output.text[1] = temp;
                }

            } else {
                data = resetEveryThing(data);
                data = getWatsonResponse(data, sync);
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }

        }

        return data;
    }

    this.handleEscalationIntent = function (data, inputText, outputText, await, defer, discovery) {

        if (data != null && data.intents != null && data.intents[0] != null && data.intents[0].intent == "escalation" && data.intents[0].confidence > 0.5 || (data.entities != null && data.entities[0] != null && data.entities[0] == 'escalation')) {
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

        if (val != '' && val.toLowerCase() != 'region' && val.toLowerCase() != 'corporate' && val.toLowerCase() != 'customer' && val.toLowerCase() != 'yes' && val.toLowerCase() != 'no') {
            var params = {
                workspace_id: workspaceId,
                entity: entityName,
                value: val
            };



            conversation.createValue(params, function (err, resp) {
                if (err) {
                    console.error(err);
                } else {
                    console.log(JSON.stringify(resp, null, 2));
                   /* var res = val.split(" ");
                    for (i = 0; i < res.length; i++) {
                        if (res[i].length > 1 && entityName != '2g-sites') {
                            //createSynonymsForValue(val, entityName, res[i]); will not create synonyms for any entity.
                        }
                    }*/
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
        conversation.createSynonym(params, function (err, resp) {
            if (err) {
                console.error(err);
            } else {
                console.log(JSON.stringify(resp, null, 2));
            }

        });
    }

    function getWatsonResponse(data, sync) {
        var conversation = new Conversation({
            // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
            // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
            username: process.env.CONVERSATION_USERNAME,
            password: process.env.CONVERSATION_PASSWORD,
            url: 'https://gateway.watsonplatform.net/conversation/api',
            version_date: '2016-10-21',
            version: 'v1'
        });
        var payload = {
            workspace_id: process.env.WORKSPACE_ID,
            context: data.context || {},
            input: {}
        };
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



};
