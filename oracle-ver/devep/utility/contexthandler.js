module.exports = function () {
    require('../db/db-oracle.js')();
    require('../db/db-mysql.js')();
    require('./stringhandler')();
    var S = require('string');
    var incidentTableName = "ARADMIN.HPD_HELP_DESK inc";
    var incidentTableName_2 = "ARADMIN.HPD_HELP_DESK inc_2";
    var taskTable = "ARADMIN.TMS_TASK";
    var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,inc.ASSIGNED_GROUP,inc.RESOLUTION_CATEGORY_TIER_2 as RESOLUTION_CATEGORY_TIER_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

    var incidentTableJoinTaskTable = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,tas.ASSIGNEE_GROUP as TASK_ASSIGNEE_GROUP,tas.ASSIGNEE as TASK_ASSIGNEE,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";
    
    this.startOverConversationWithContext = function (response) {

        if (response != null && response.entities != null && response.entities[0] != null && response.entities[0].entity == 'startoverchat') {
            console.log("Start overing chat");
            // clearing context for corporate customer
            /*response = resetCustomerContext(response);
            response = resetIncidentContext(response);
            response = resetRegionContext(response);
            response = resetTransmissionFailureContext(response);*/
            response = resetEveryThing(response);

        }
        return response;

    }
    // show child incidents for intent 1
    this.showChildIncidentsWithContext = function (response, sync,conversationId) {
        if (response != null && response.context.cxt_show_incident_details != null && response.context.cxt_show_incident_details == true && response.context.cxt_incident_number != null && response.context.cxt_incident_number != -1 && response.context.cxt_is_master_incident != null && response.context.cxt_is_master_incident) {

            //var childsql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.ORIGINAL_INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(response.context.cxt_incident_number) + "'";
            var childsql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.ORIGINAL_INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(response.context.cxt_incident_number) + "'";
            console.log("query from context variable =>" + childsql);
            //var childoutput = executeQuerySync(childsql);
            var connection = getOracleDBConnectionRemedy(sync);
            var childoutput = getOracleQueryResult(connection, childsql, sync);
            doRelease(connection);
            var outputText = '';
            response = showChildIncidents(childoutput.rows, outputText, response, conversationId);
           /* if (response.output!= null) {
                response.output.text = outputText;
            }*/
            response = resetEveryThing(response);

        }
        return response;
    }

    this.showParentIncidentDetailsWithContext = function (response, sync) {
        // show incident details intent 1 :: showing child of master
        if (response != null && response.context.cxt_show_incident_details != null && response.context.cxt_show_incident_details == true && response.context.cxt_parent_incident_number != null && response.context.cxt_parent_incident_number != -1 && response.context.cxt_is_master_incident != null && !response.context.cxt_is_master_incident) {
            var childsql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(response.context.cxt_parent_incident_number) + "'";
            console.log("query from context variable =>" + childsql);
            //var childoutput = executeQuerySync(childsql);
            var connection = getOracleDBConnectionRemedy(sync);
            var childoutput = getOracleQueryResult(connection, childsql, sync);
            doRelease(connection);
            var outputText = '';
            console.log("childoutput.rows.length=>"+childoutput.rows.length);
            if (childoutput.rows.length == 0) {
               
                var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + correctIncidentNumberFormat(response.context.cxt_parent_incident_number) + "'";
                // "(SELECT * FROM (SELECT incident_number, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where incident_number = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.incident_number = B.incident_number";
                console.log("query without task=>"+sql);
                var connection = getOracleDBConnectionRemedy(sync);
                childoutput = getOracleQueryResult(connection, sql, sync);
                console.log("childoutput.rows.length=>"+childoutput.rows.length);
                doRelease(connection);
            } 
           
            response = showParentIncidentDetails(childoutput.rows, outputText, response);
            response = resetEveryThing(response);

        }
        return response;
    }

    this.showMasterIncidentForRegionWithContext = function (response, sync, conversationId) {

        // intent 2 :: Master Incident
        var outputText = [];
        if (response != null && response.context.cxt_region_show_master_incident) {
            
            console.log("response.context.cxt_region_name =>" + response.context.cxt_region_name);
            var regionLookupQuery = "Select * from region_lookup where (LOWER(full_name) = '" + response.context.cxt_region_name.toLowerCase() + "' OR LOWER(abbreviation) = '" + response.context.cxt_region_name.toLowerCase() + "')";
            console.log("region lookup query for customer intent. =>" + regionLookupQuery);
            var lookupResult = executeQuerySync(regionLookupQuery);
            if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows[0] != null) {
                customerRegion = lookupResult.data.rows[0].full_name;
            } else {
                customerRegion = response.context.cxt_region_name;
            }

            console.log("response.context.cxt_child_incident_count_for_region=>" + response.context.cxt_child_incident_count_for_region);
            // if no master found with child association list all masters that are found for the region.
            if (response.context.cxt_child_incident_count_for_region == 0) {
                var childsql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)";
                childsql += " AND inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                childsql += " AND LOWER(inc.region) = '" + customerRegion.toLowerCase() + "'";
                console.log("query to get Master Incident from context variable =>" + childsql);
                //masterIncidentsDetailsResult = executeQuerySync(childsql);
                var connection = getOracleDBConnectionRemedy(sync);
                var masterIncidentsDetailsResult = getOracleQueryResult(connection, childsql, sync);
                doRelease(connection);
                outputText = DisplyDetailsForMasterIncidents(masterIncidentsDetailsResult.rows, outputText, response, conversationId);

            } else {
                //var childsql = "Select count(inc.INCIDENT_NUMBER) as COUNT ,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER AS PARENT_INCIDENT_NUMBER,inc.HPD_CI AS SITE_NAME,inc.DESCRIPTION AS SUMMARY,inc.REGION from " + incidentTableName + " inner join " + incidentTableName_2 + " on ( inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) AND LOWER(inc.REGION) = '" + customerRegion+ "' group by (inc.STATUS,inc.ORIGINAL_INCIDENT_NUMBER,inc.HPD_CI,inc.DESCRIPTION,inc.REGION,inc.INCIDENT_NUMBER) order by COUNT desc";
                var masterSql = "Select distinct inc.INCIDENT_NUMBER,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,inc.ORIGINAL_INCIDENT_NUMBER AS PARENT_INCIDENT_NUMBER,inc.HPD_CI AS SITE_NAME,inc.DESCRIPTION AS SUMMARY,inc.REGION from " + incidentTableName + " inner join " + incidentTableName_2 + " on ( inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) ";
                //masterSql += " AND inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                masterSql += " AND LOWER(inc.REGION) = '" + customerRegion.toLowerCase() + "'";
                console.log("query to get Master Incident from with child associations context variable =>" + masterSql);
                //var masterIncidentsDetailsResult = executeQuerySync(childsql);
                var connection = getOracleDBConnectionRemedy(sync);
                var masterIncidentsDetailsResult = getOracleQueryResult(connection, masterSql, sync);
                doRelease(connection);
                console.log("masterIncidentsDetailsResult.length=>" + masterIncidentsDetailsResult.rows.length);
                outputText = showMasterIncidentsForRegion(masterIncidentsDetailsResult.rows, outputText, response, conversationId);
            }
 
            if (response.output != null ) {
                response.output.text = outputText;
                response = resetEveryThing(response);
            }

        }
        
        //response.output.text = response.ouput.text;
        return response;

    }
    // intent 2 :: isolated fault
    // site name or node name flow
    this.regionIntentIsolatedFaultFlowWithContext = function (response, sync,conversationId) {
        var outputText = '';
        if (response != null && response.context.cxt_region_show_isolated_fault && response.context.cxt_site_name_region_flow == null && !response.context.cxt_region_flow_search_for_location) {
            // update message for entering site with actual sites in region of query.
            if (response.context.cxt_region_full_name != null) {
                var listOfSitesQuery = "SELECT distinct HPD_CI as SITE_NAME FROM " + incidentTableName + " WHERE LOWER(region) = '" + response.context.cxt_region_full_name.toLowerCase() + "' AND ROWNUM < 11";
                console.log("listOfSitesQuery =>" + listOfSitesQuery);
                //var listOfSitesOutput = executeQuerySync(listOfSitesQuery);
                var connection = getOracleDBConnectionRemedy(sync);
                var listOfSitesOutput = getOracleQueryResult(connection, listOfSitesQuery, sync);
                doRelease(connection);
                console.log("listOfSitesOutput.rows.length =>" + listOfSitesOutput.rows.length);
                if (listOfSitesOutput != null && listOfSitesOutput.rows.length > 0) {
                    
                    outputText = "<b>Do you know the site or node name. Common names in " + response.context.cxt_region_full_name + " are </b> <br/>";
                    outputText += "<table><tr><td><ul>";
                    for (i = 0; i < listOfSitesOutput.rows.length; i++) {
                        
                        if (i > 0 && i % 4 == 0) {
                            outputText += "</ul></td><td><ul>";
                        }
                        outputText += "<li><a href='#' id='site-flow-" + i + "' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + listOfSitesOutput.rows[i].SITE_NAME + "</a></li>";
                       // if (i < listOfSitesOutput.rows.length - 1)
                       // outputText += ",&nbsp;";


                    }
                    outputText += "</ul></td></tr></td></table>";

                    outputText += "<br/><br/> <b>If you do not know the site or node name select <a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >No</a> to search based on Location</b>";
                }
                response.context.cxt_region_full_name = null;
            }

            if (response.output != null) {
                response.output.text = outputText;
            }
            //response.output.text = response.ouput.text;
        }

        // site name or node name flow

        if (response != null && response.context.cxt_region_show_isolated_fault && response.context.cxt_site_name_region_flow != null) {


            console.log("response.context.cxt_site_name_region_show_incident_detail=>" + response.context.cxt_site_name_region_show_incident_detail);
            var siteName = response.context.cxt_site_name_region_flow;
            var sitenameSql = "SELECT DISTINCT LOCATION_NAME AS LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE LOWER(CI_NAME) = '" + siteName.toLowerCase() + "'";
            console.log("Query for matching site name oracle database table. =>" + sitenameSql);
            var connection = getOracleDBConnection(sync);
            var sitenameOutput = getOracleQueryResult(connection, sitenameSql, sync);
            doRelease(connection);

            if (sitenameOutput != null && sitenameOutput.rows != null && sitenameOutput.rows.length >= 1) {
                // site name found
                response.context.cxt_site_name_region_flow_found = true;
                if (response.context.cxt_site_name_region_show_incident_detail) {

                    console.log("incidents found for site name " + response.context.cxt_site_name_region_flow);
                    var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.status in (0,1,2,3)";
                    incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                    incidentSql += " and LOWER(HPD_CI) = '" + response.context.cxt_site_name_region_flow.toLowerCase() + "'";// and Lower(status) != 'closed' ;";
                    console.log("query from context variable =>" + incidentSql);
                    var connection = getOracleDBConnectionRemedy(sync);
                    var listOfSitesOutput = getOracleQueryResult(connection, incidentSql, sync);
                    doRelease(connection);
                    if (listOfSitesOutput != null && listOfSitesOutput.rows != null) {
                        outputText = showIncidentsForSiteName(listOfSitesOutput.rows, outputText, response, conversationId); // this method is used for displaying incident information
                    } else {
                        listOfSitesOutput = {};
                        outputText = showIncidentsForSiteName(listOfSitesOutput, outputText, response, conversationId);
                    }
                    response.context.cxt_site_name_region_flow_found = false;
                    response.context.cxt_site_name_region_flow = null;


                } else {
                    response.context.cxt_site_name_region_show_incident_detail = true;
                }

            } else {
                // will look for nodes now.

                var nodeName = response.context.cxt_site_name_region_flow;
                var nodeNameSql = "Select * from nodes_lookup where node like '" + nodeName + "'";
                console.log("Query for matching node name in nodes_lookup table. =>" + nodeNameSql);
                var nodenameOutput = executeQuerySync(nodeNameSql);
                if (nodenameOutput != null && nodenameOutput.data.rows != null && nodenameOutput.data.rows.length > 0) {
                    // node is found instead of sitename we will follow the region flow for site name.

                    response.context.cxt_site_name_region_flow_found = true; // setting flag to true to avoid site name not found message.

                    if (response.context.cxt_site_name_region_show_incident_detail) {

                        response.context.cxt_location_name_region_flow = nodenameOutput.data.rows[0].location;
                        // when we assign fetched location to context variable the location name flow will run after this.
                        response.context.cxt_site_name_region_flow = null;
                        response.context.cxt_site_name_region_flow_found = false;
                    } else {
                        response.context.cxt_site_name_region_show_incident_detail = true;
                    }
                    //response.ouput.text = response.output.text[0];
                }


            }


            if (response.context.cxt_site_name_region_flow_found && response.context.cxt_site_name_region_flow != null) {
                outputText = "<b>Site name found do you want to see its incidents, reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a></b>.";
                response.context.cxt_site_name_region_flow_found = true;
                response.context.cxt_site_name_region_show_incident_detail = true;


            }
            if (!response.context.cxt_site_name_region_flow_found && !response.context.cxt_site_name_region_show_incident_detail && !response.context.cxt_region_flow_search_for_location) {
                outputText = "<b>Site name <b>not</b> found do you want to search with location? reply with <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a></b>.";
                response.context.cxt_region_flow_search_for_location = true;
                response.context.cxt_site_name_region_flow = null;
            }
            console.log("outputText=>" + outputText);
            console.log("Region Flow => response.context.cxt_site_name_region_show_incident_detail=>" + response.context.cxt_site_name_region_show_incident_detail);
            //response.output.text = response.ouput.text;
            if (response.output != null) {
                response.output.text = outputText;
            }

        }

        //console.log("Intent isolated fault location name flow");
        if (response != null && response.context.cxt_location_name_region_flow != null) {
            response.context.cxt_location_name_region_flow_found = true;
            console.log("response.context.cxt_location_name_region_flow_found =>" + response.context.cxt_location_name_region_flow_found);
            var locationSql = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(LOCATION_NAME) = '" + response.context.cxt_location_name_region_flow.toLowerCase() + "'";
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
                incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                console.log(incidentSql);
                //var incidentOutput = executeQuerySync(incidentSql);
                var connection = getOracleDBConnectionRemedy(sync);
                var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
                doRelease(connection);
        
                outputText = showIncidentsForRegionBasedOnLocation(incidentOutput.rows, outputText, response, conversationId);
                response = resetEveryThing(response);
            } else {

                outputText = "<b>Sorry the entered location is not< found./b><br/>";// + response.output.text[0];
            }

            
            if (response.output != null) {
                response.output.text = outputText;
                response = resetEveryThing(response);
            }
            
        }

        return response;
    }

    this.technologyTypeFlowWithContext = function (response, sync,conversationId) {
        //console.log("i am here 6");
        // transmission location flow : intent
        if (response!= null && response.context.cxt_location_name_trx_flow != null) {
            console.log("response.context.cxt_location_name_trx_flow =>" + response.context.cxt_location_name_trx_flow);
            var locationSql = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(LOCATION_NAME) = '" + response.context.cxt_location_name_trx_flow.toLowerCase() + "'";
            console.log("location query from context variable for trx =>" + locationSql);
            //var locationOutput = executeQuerySync(locationSql);
            var connection = getOracleDBConnection(sync);
            var locationOutput = getOracleQueryResult(connection, locationSql, sync);

            var inOperator = "(";
            if (locationOutput != null && locationOutput.rows.length > 0) {
                console.log("locationOutput.rows.length =>" + locationOutput.rows.length);

                response.context.cxt_location_name_trx_flow_found = true;
                for (i = 0; i < locationOutput.rows.length; i++) {

                    inOperator += "'" + locationOutput.rows[i].CI_NAME + "'";

                    if (i < locationOutput.rows.length - 1) {
                        inOperator += ",";
                    }


                }
                inOperator += ")";
                var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.HPD_CI in " + inOperator + " and INC.INCIDENT_ASSOCIATION_TYPE = 0 AND inc.status in (0,1,2,3)";
                incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
                if (response.context.cxt_tx_name != null) {

                    if (response.context.cxt_tx_name.toLowerCase() == 'transmission') {
                        incidentSql += " and LOWER(inc.GENERIC_CATEGORIZATION_TIER_1) in ('transport tx','transport','transport cdn nsa 3rd party','transport cdn 3rd party','transport cdn','transport tx 3rd party','transport_tx') ";
                    } else {
                        incidentSql += " and LOWER(inc.GENERIC_CATEGORIZATION_TIER_1) = '" + response.context.cxt_tx_name.toLowerCase() + "' ";
                    }
                }

                //incidentSql +=  " AND LOWER(inc.GENERIC_CATEGORIZATION_TIER_1) = '" + response.context.cxt_tx_name.toLowerCase() + "' ";

                console.log("incident sql =>" + incidentSql);
                //var incidentOutput = executeQuerySync(incidentSql);
                var connection = getOracleDBConnectionRemedy(sync);
                var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
                doRelease(connection);
                
                var outputText = '';
                outputText = showIncidentsForTransmissionFailureOnLocation(incidentOutput.rows, outputText, response, conversationId);
                //console.log("outputText=>"+outputText);
                if (response.output!= null) {
                    response.output.text = outputText;
                }
                
                //response.ouput.text = outputText;
                response = resetEveryThing(response);

            } else {
                // location not found.
                response = resetEveryThing(response);
            }


        } else {
            // update location message for Transmission failure here.	
        }
        console.log("response.output.text=>"+response.output.text);
        return response;

    }

    this.corporateCustomerFlowWithContext = function (response, sync) {

        if (response!= null && response.context.cxt_matched_customer_count > 1 && response.entities != null && response.entities[0].entity == 'yes' && response.context.cxt_customer_drill_down_region == null) {
            var outputText = response.output.text[0];
            var sql = response.context.cxt_customer_region_list_query;
            var connection = getOracleDBConnection(sync);
            var listOfRegionForCustomer = getOracleQueryResult(connection, sql, sync);
            if (listOfRegionForCustomer != null && listOfRegionForCustomer.rows != null && listOfRegionForCustomer.rows.length > 0) {
                var custRegion = null;
                var regionList = "<table class='w-50'><tr>";
                regionList += "<td><ul>";
                var rowCounter = 0;
                for (i = 0; i < listOfRegionForCustomer.rows.length; i++) {
                    custRegion = listOfRegionForCustomer.rows[i].REGION;
                    regionList += "<li><a href='#' id='" + custRegion + "' title='Click to paste value' onclick='copyToTypingArea(this);'>" + custRegion + "</a></li>";
                    rowCounter++;
                    if (i > 0 && rowCounter % 4 == 0) {
                        regionList += "</ul></td><td><ul>";
                    }
                }

                regionList += "</ul></td>";
                regionList += "</tr></table>";
                
                console.log("response.output=>"+JSON.stringify(response.output));
                
                outputText = S(outputText).replaceAll('[region_list_for_customer]', regionList).s;
              
            } else {
                outputText = S(outputText).replaceAll('[region_list_for_customer]', "KZN,NGA,LIM").s;
            }
            response.output.text = outputText;
        }
        if (response != null && response.context.cxt_user_selected_customer == null && response.context.cxt_customer_query != null && response.context.cxt_customer_drill_down_region != null && response.context.cxt_incident_data_for_customer && response.context.cxt_matched_customer_count > 1) {
            var outputText = response.output.text[0];
            var sql = response.context.cxt_customer_query;
            sql += " AND LOWER(REGION) = '" + response.context.cxt_customer_drill_down_region.toLowerCase() + "'"
            console.log("Customer Query When region is specified in start =>" + sql);
            var connection = getOracleDBConnection(sync);
            var listOfCustomerOutput = getOracleQueryResult(connection, sql, sync);
            doRelease(connection);
            var matchedCustomerOnRegion = "<table class='w-100'><tr>";
            var customerArr = [];
            var customerName = null;
            response.context.cxt_matched_customer_count = listOfCustomerOutput.rows.length;
            if (listOfCustomerOutput.rows.length > 0) {

                for (i = 0; i < listOfCustomerOutput.rows.length; i++) {
                    customerArr[i] = listOfCustomerOutput.rows[i].MPLSVPN_NAME
                    matchedCustomerOnRegion += "<tr>";
                    customerName = listOfCustomerOutput.rows[i].MPLSVPN_NAME;
                    // add all values returned for a customer with region in watson training.
                    createEntityValue(customerName, "complex-corporate-customers");
                    //customerName = handleDigitsWithSlashInCustomerName(customerName);
                    matchedCustomerOnRegion += "<td><a href='#' id='" + listOfCustomerOutput.rows[i].IFACE_VLANID + "' onclick='copyToTypingAreaCustomer(this);' title='Click here to paste text in typing area'>" + customerName + "</a></td>";
                    matchedCustomerOnRegion += "<td>" + listOfCustomerOutput.rows[i].IFACE_VLANID + "</td>";
                    //matchedCustomerOnRegion += "<td>" + listOfCustomerOutput.rows[i].REGION + "</td>";
                    matchedCustomerOnRegion += "</tr>";



                }
                matchedCustomerOnRegion += "</table>";

               // console.log("response.ouput.text=>" + response.output.text[0]);

                outputText = S(outputText).replaceAll('[region_filtered_customer_list]', matchedCustomerOnRegion).s;
                outputText = S(outputText).replaceAll('[region_cust_count]', response.context.cxt_matched_customer_count).s;
            } else {
                outputText = "<br/><b>Sorry no result found for specified customer in " + response.context.cxt_customer_drill_down_region + ".&nbsp; Click on <a href='#' id='yes' onclick='copyToTypingArea(this);'>yes</a> to search again.</b>";

            }
            response.context.cxt_incident_data_for_customer = false;
            response.output.text[0] = outputText;
        }
        // when customer is picked up from the list of customers returned by watson or db
        if (response != null && response.context.cxt_user_selected_customer != null && !response.context.cxt_customer_show_incident_data) {

            //var sql = response.context.cxt_customer_query;
            // show incident response here for selected customer.
            //response.context.cxt_user_selected_customer = restoreDigitsWithSlashInCustomerName(response.context.cxt_user_selected_customer);
            var vlanId = -1;
            var outputText = response.output.text[0];
            vlanId = S(response.context.cxt_user_selected_customer).between("<span class='hidden'>", '@</span>').s
            response.context.cxt_user_selected_customer = S(response.context.cxt_user_selected_customer).replaceAll("<span class='hidden'>", '').s;
            response.context.cxt_user_selected_customer = S(response.context.cxt_user_selected_customer).replaceAll("@</span>", '').s;
            response.context.cxt_user_selected_customer = S(response.context.cxt_user_selected_customer).chompLeft(vlanId).s;

            console.log("vlanId=>" + vlanId);

            var sql = "Select NID,MPLSVPN_NAME,IFNR,IFALIAS,IFACCURSTRING,NODE_NM from  tellabs_ods.ebu_vlan_status_mv";
            if (response.context.cxt_customer_drill_down_region == null)
                sql += " where LOWER(MPLSVPN_NAME) like '%" + response.context.cxt_user_selected_customer.toLowerCase() + "%'";
            if (response.context.cxt_customer_drill_down_region != null)
                sql += " where LOWER(MPLSVPN_NAME) = '" + response.context.cxt_user_selected_customer.toLowerCase() + "'";

            if (vlanId > 0) {
                sql += " AND IFACE_VLANID = '" + vlanId + "'";
            }

            console.log("\nSQL For Getting Nodes on Customer Name=>" + sql);
            var connection = getOracleDBConnection(sync);
            var output = getOracleQueryResult(connection, sql, sync);
            doRelease(connection);
            console.log("node count for customer =>" + output.rows.length);
            var nodeId = null;
            if (output != null && output.rows != null && output.rows.length >= 1) {

                nodeId = output.rows[0].NID;
                outputText = "<table class='w-80'><tr>";
                for (i = 0; i < output.rows.length; i++) {
                    outputText += "<td>";
                    outputText += output.rows[i].MPLSVPN_NAME + "<br/>" + output.rows[i].IFNR + "<br/>" + output.rows[i].IFALIAS + "<br/>"
                        + output.rows[i].IFACCURSTRING + "<br/>" + output.rows[i].NID + "<br/>" + output.rows[i].NODE_NM + "<br/><br/>";
                        outputText += "</td>";
                    if (i > 1 && i % 2 == 0) {
                        outputText += "</tr><tr>";
                    }

                }
                outputText += "</tr></table>";
                outputText += "<b>Want to see incident details <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a>&nbsp;<a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>no</a></b>.";
                //response.context.cxt_user_selected_customer = null;
                response.context.node_output_query = sql;
                response.output.text = outputText;
            } else {
                outputText = "<b>There are no nodes available for this corporate customer. Please click <a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>yes</a> to do another search.</b>.";
                response = resetEveryThing(response);
                response.output.text = outputText;
                // there are no nodes for this customer, handle here.
            }

        }

        
        if (response!= null && response.context.cxt_customer_show_incident_data && response.context.node_output_query != null) {
            var outputText = '';
            console.log("response.context.cxt_customer_show_incident_data=>" + response.context.cxt_customer_show_incident_data);
            response.context.cxt_customer_flow_node_detail_query_executed = true; // this flag will help to clear the context variables for customer.
            //response.context.cxt_customer_input_text = null;
            var connection = getOracleDBConnection(sync);
            var output = getOracleQueryResult(connection, response.context.node_output_query, sync);
            doRelease(connection);
            var nodeId = null;

            if (output != null) {
                nodeId = output.rows[0].NID;
            }


            var nodeOutput = null;
            if (nodeId != null) {
                var nodeSql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and (inc.HPD_CI in('NODE" + nodeId + "'";
                for (j = 1; j < output.rows.length; j++) {
                    nodeId = output.rows[j].NID;
                    nodeSql += " , 'NODE" + nodeId + "'"
                }
                nodeSql += "))";
                console.log(nodeSql);
                var connection = getOracleDBConnectionRemedy(sync);
                nodeOutput = getOracleQueryResult(connection, nodeSql, sync);
                doRelease(connection);
            }

            if (nodeOutput != null && nodeOutput.rows.length == 0) {


                outputText = "<br/><b>I could not find any incident response for this customer in Remedy. If you like to speak to an operator please dial 082918.<br/></b>";
                //console.log("incident response not found for customer=>" + response.ouput.text);
                response.context.cxt_incident_data_for_customer = false;


            } else {
                console.log("incident response found for customer");
                outputText = "<table class='w-100'>";
                outputText += "<tr><th>INCIDENT NUMBER</th><th>DESCRIPTION</th><th>STATUS</th><th>SITE NAME</th></tr>";
                for (i = 0; i < nodeOutput.rows.length; i++) {


                    outputText += "<tr><td><a href='#' id='" + nodeOutput.rows[i].INCIDENT_NUMBER + "' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + nodeOutput.rows[i].INCIDENT_NUMBER + "</a></td><td>" + nodeOutput.rows[i].SUMMARY + "</td><td>" + nodeOutput.rows[i].INC_STATUS + "</td><td>" + nodeOutput.rows[i].SITE_NAME + "</td></tr>";

                }
                outputText += "</table><br/>";

            }

            outputText = addFeedbackButton(outputText);
            console.log ("response.output=>"+JSON.stringify(response.output));
            console.log ("response.output.text[1]=>"+JSON.stringify(response.output.text[1]));
            //outputText += response.output.text[response.output.text.length - 1]; // what else i can do for you message.
            //response.output.text = outputText;
            if (response.output.text[0] != null) {
                var temp = response.output.text[0]; // what else i can do for you message.
                response.output.text[0] = outputText;
                response.output.text[1] = temp;
            } else {
                //outputText += response.output.text[1]; // what else i can do for you message.
                response.output.text[0] = outputText;
            }

            // put this reset variable here for fixing an issue related to corporate customer. will check and decide accordingly.
            if (response.context.cxt_unknown_customer_case) {
                response.context.cxt_customer_flow_found = null;
                response.context.cxt_unknown_input = null;
                response.context.cxt_customer_input_text = null;
                response.context.cxt_unknown_customer_case = false;
                response.context.node_output_query = null;
                response.context.cxt_matched_customer_count = 0;
            }
            // clearing context for corporate customer
            response = resetEveryThing(response);

        } else if (response != null && response.context.node_output_query != null && response.entities != null && response.entities[0].entity == 'No') {
            // clearing context for corporate customer
            response = resetEveryThing(response);
            
        }

        return response;


    }

    this.userLoginWithContext = function (response) {

        if (response != null && !response.context.cxt_user_logged_in && response.context.cxt_verify_user) {
            console.log("verifying user credentials");

            if (response.context.cxt_user_email != null && response.context.cxt_user_password != null) {
                var loginQuery = "Select first_name,last_name from bot_users where email = '" + response.context.cxt_user_email + "' and password = '" + response.context.cxt_user_password + "';";
                var loginOutPut = executeQuerySync(loginQuery);
                if (loginOutPut.data.rows.length != 0) {
                    console.log("credentials verified");
                    response.context.cxt_user_logged_in = true;
                    response.context.cxt_user_full_name = loginOutPut.data.rows[0].first_name + " " + loginOutPut.data.rows[0].last_name;
                    userFullName = response.context.cxt_user_full_name;
                    //response.ouput.text = response.output.text[0];//"Your credentials are verified. You are now logged in. ";


                } else {
                    console.log("credentials not verified");
                   /* if (response.output != null && response.output.text[0] != null){
                        var outputText = response.output.text[0];
                        response.output.text = outputText;
                    }
                    if (response.output.text[1] != null) {
                        response.ouput.text += response.output.text[1];
                    }*/
                    //console.log(response.ouput.text);
                    response.context.cxt_user_email = null;
                    response.context.cxt_user_password = null;
                    response.context.cxt_user_logged_in = false;
                    response.context.cxt_verify_user = false;
                }
            }


        }
        return response;
    }

};
