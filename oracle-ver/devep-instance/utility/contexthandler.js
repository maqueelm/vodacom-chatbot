/**
 * Description
 * @method exports
 * @return 
 */
module.exports = function () {
    require('../db/db-oracle.js')();
    require('./stringhandler')();
    require('./sqlhandler')();
    require('./watsonentityhandler')();
    var S = require('string');
    /**
     * Description
     * @method startOverConversationWithContext
     * @param {} response
     * @param {} sync
     * @return response
     */
    this.startOverConversationWithContext = function (response, sync) {

        if (response != null && response.entities != null && response.entities[0] != null && response.entities[0].entity == 'startoverchat') {
            console.log("\nstartOverConversationWithContext\n");
            var userName = response.context.cxt_user_full_name;
            console.log("old conversation id =>" + response.context.conversation_id);
            response = resetEveryThing(response);

            response.context.cxt_user_logged_in = true;
            response.context.cxt_user_full_name = userName;
            console.log("new conversation id =>" + response.context.conversation_id);

        }
        return response;

    }
    // show child incidents for intent 1
    /**
     * Description
     * @method showChildIncidentsWithContext
     * @param {} response
     * @param {} sync
     * @param {} conversationId
     * @return response
     */
    this.showChildIncidentsWithContext = function (response, sync, conversationId) {

        if (response != null && response.context.cxt_show_incident_details != null && response.context.cxt_show_incident_details == true && response.context.cxt_incident_number != null && response.context.cxt_incident_number != -1 && response.context.cxt_is_master_incident != null && response.context.cxt_is_master_incident) {
            console.log("\nshowChildIncidentsWithContext\n");
            var incidentNumber = correctIncidentNumberFormat(response.context.cxt_incident_number);
            var connection = getOracleDBConnectionRemedy(sync);
            if (connection) {
                childoutput = getChildIncidentForMaster_SqlHandler(incidentNumber, sync, connection);
                var outputText = '';
                response = showChildIncidents(childoutput.rows, outputText, response, conversationId);
                response = resetEveryThing(response);
            }
        }
        return response;
    }

    /**
     * Description
     * @method showParentIncidentDetailsWithContext
     * @param {} response
     * @param {} sync
     * @return response
     */
    this.showParentIncidentDetailsWithContext = function (response, sync) {

        // show incident details intent 1 :: showing child of master
        if (response != null && response.context.cxt_show_incident_details != null && response.context.cxt_show_incident_details == true && response.context.cxt_parent_incident_number != null && response.context.cxt_parent_incident_number != -1 && response.context.cxt_is_master_incident != null && !response.context.cxt_is_master_incident) {
            console.log("\nshowParentIncidentDetailsWithContext\n");
            var incidentNumber = correctIncidentNumberFormat(response.context.cxt_parent_incident_number);
            var connection = getOracleDBConnectionRemedy(sync);
            if (connection) {
                var childoutput = getParentIncidentDetails_SqlHandler(incidentNumber, sync, connection);
                var outputText = '';
                console.log("childoutput.rows.length=>" + childoutput.rows.length);
                if (childoutput.rows.length == 0) {
                    childoutput = getIncidentDataOnIncidentNumber_SqlHandler(incidentNumber, sync, connection);
                    console.log("childoutput.rows.length=>" + childoutput.rows.length);
                }
                doRelease(connection);
                response = showParentIncidentDetails(childoutput.rows, outputText, response);
                response = resetEveryThing(response);

            } else {
                response.output.text = "Sorry i could not connect to remedy at the moment, try again later.";
            }


        }
        return response;
    }

    /**
     * Description
     * @method showMasterIncidentForRegionWithContext
     * @param {} response
     * @param {} sync
     * @param {} conversationId
     * @return response
     */
    this.showMasterIncidentForRegionWithContext = function (response, sync, conversationId) {

        // intent 2 :: Master Incident
        var outputText = [];
        if (response != null && response.context.cxt_region_show_master_incident) {
            console.log("\nshowMasterIncidentForRegionWithContext\n");
            console.log("response.context.cxt_region_name =>" + response.context.cxt_region_name);
            var lookupResult = regionLookUp_SqlHandler(response.context.cxt_region_name);

            var regionFullName = '';
            if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows != null && lookupResult.data.rows.length > 0) {

                if (lookupResult.data.rows.length == 1) {
                    regionFullName = "'" + lookupResult.data.rows[0].full_name.toLowerCase() + "'";
                } else {
                    regionFullName = '';
                    for (i = 0; i < lookupResult.data.rows.length; i++) {

                        regionFullName += "'" + lookupResult.data.rows[i].full_name.toLowerCase() + "'";

                        if (i < lookupResult.data.rows.length - 1) {
                            regionFullName += ",";
                        }
                    }

                }
                //customerRegion = lookupResult.data.rows[0].full_name;
            } else {
                regionFullName = "'" + response.context.cxt_region_name + "'";
            }

            console.log("response.context.cxt_child_incident_count_for_region=>" + response.context.cxt_child_incident_count_for_region);
            // if no master found with child association list all masters that are found for the region.
            if (response.context.cxt_child_incident_count_for_region == 0) {
                var connection = getOracleDBConnectionRemedy(sync);
                if (connection) {
                    var masterIncidentsDetailsResult = getMasterIncidentsWithNoChildAssociation_SqlHandler(regionFullName, sync, connection);
                    if (masterIncidentsDetailsResult != null) {
                        outputText = DisplyDetailsForMasterIncidents(masterIncidentsDetailsResult.rows, outputText, response, conversationId);
                    }

                } else {
                    outputText = "Sorry i could not connect to remedy, please try again later.";
                }



            } else {

                var connection = getOracleDBConnectionRemedy(sync);
                if (connection) {
                    var masterIncidentsDetailsResult = getMasterIncidentsWithChildAssociation_SqlHandler(regionFullName, sync, connection);
                    if (masterIncidentsDetailsResult != null) {
                        console.log("masterIncidentsDetailsResult.length=>" + masterIncidentsDetailsResult.rows.length);
                        outputText = showMasterIncidentsForRegion(masterIncidentsDetailsResult.rows, outputText, response, conversationId);
                    }

                } else {
                    outputText = "Sorry i could not connect to remedy, please try again later.";
                }

            }

            if (response.output != null) {
                response.output.text = outputText;
                response = resetEveryThing(response);
            }

        }

        //response.output.text = response.ouput.text;
        return response;

    }
    // intent 2 :: isolated fault
    // site name or node name flow
    /**
     * Description
     * @method regionIntentIsolatedFaultFlowWithContext
     * @param {} response
     * @param {} sync
     * @param {} conversationId
     * @return response
     */
    this.regionIntentIsolatedFaultFlowWithContext = function (response, sync, conversationId) {

        var outputText = '';
        if (response != null && response.context.cxt_region_show_isolated_fault && response.context.cxt_site_name_region_flow == null && !response.context.cxt_region_flow_search_for_location) {

            console.log("\nregionIntentIsolatedFaultFlowWithContext\n");
            if (response.context.cxt_region_full_name != null) {

                var connection = getOracleDBConnectionRemedy(sync);
                var listOfSitesOutput = getListOfSiteNamesBasedOnRegion_SqlHandler(response.context.cxt_region_full_name,sync,connection);
                var inOperator = "(";
                if (listOfSitesOutput != null && listOfSitesOutput.rows.length > 0) {
                    console.log("listOfSitesOutput.rows.length =>" + listOfSitesOutput.rows.length);
                    outputText = "<b>Please pick the site name for region " + response.context.cxt_region_name + " from list below. </b><br/><b>If you want to search based on location click <a href='#' id='no' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >No</a></b>";
                    outputText += "<table class='w-90'><tr><td><ul>";
                    var columnCount = 0;
                    console.log("Adding sitenames to entity 2g-sites list if not exists already.");
                    for (i = 0; i < listOfSitesOutput.rows.length; i++) {

                        if (i > 0 && i % 4 == 0) {
                            outputText += "</ul></td><td><ul>";
                            columnCount++;
                        }
                        if (columnCount > 1) {
                            outputText += "</ul></td></tr><tr><td><ul>";
                            columnCount = 0;
                        }

                        var siteName = listOfSitesOutput.rows[i].SITE_NAME;
                        if (siteName != null && siteName != '') {
                            siteName = S(siteName).replaceAll(' ', '').s;
                            outputText += "<li><a href='#' id='" + siteName + "' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area'>" + listOfSitesOutput.rows[i].SITE_NAME + "</a></li>";
                            inOperator += "'" + listOfSitesOutput.rows[i].SITE_NAME + "'";
                            var val = listOfSitesOutput.rows[i].SITE_NAME;

                            createEntityValue(val, "2g-sites");

                            if (i < listOfSitesOutput.rows.length - 1) {
                                inOperator += ",";
                            }
                        }

                    }
                    inOperator += ")";

                    outputText += "</ul></td></tr></td></table>";
                    //var locationSql = "SELECT DISTINCT LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE CI_NAME IN " + inOperator + " and LOWER(LOCATION_NAME) != 'unknown' and LOWER(LOCATION_NAME) not like 'estimated%' order by LOCATION_NAME ";
                    response.context.cxt_location_list_region_fault_flow_query = getLocationsForSiteNames_SqlHandler(inOperator, response);
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

            console.log("\nregionIntentIsolatedFaultFlowWithContext\n");
            console.log("response.context.cxt_site_name_region_show_incident_detail=>" + response.context.cxt_site_name_region_show_incident_detail);
            response.context.cxt_site_name_region_flow_found = true;
            response.context.cxt_site_name_region_show_incident_detail = true;
            /**
             * Since now site names are extracted from incident table, so no need to verify those site names again in name_repo.NMG_CHATBOT_MV.Skipping all the below code
             * and just setting the response.context.cxt_site_name_region_flow_found = true. This change will now show incident data as soon as someone selects sitename
             * from the list.
             */
            var siteName = response.context.cxt_site_name_region_flow;
            var connection = getOracleDBConnectionRemedy(sync);
            var inOperator = null;
            var incidentOutput = getIncidentsForIsolatedFaultWithSiteNames_SqlHandler(siteName,inOperator,sync,connection);
            outputText = showIncidentsForRegionBasedOnLocation(incidentOutput.rows, outputText, response, conversationId);
            response = resetEveryThing(response);
            if (response.output != null) {
                response.output.text = outputText;
            }

        }

        //console.log("Intent isolated fault location name flow");
        if (response != null && response.context.cxt_location_name_region_flow != null) {
            console.log("\nregionIntentIsolatedFaultFlowWithContext :: isolated fault location name flow\n");
            response.context.cxt_location_name_region_flow_found = true;
            console.log("response.context.cxt_location_name_region_flow_found =>" + response.context.cxt_location_name_region_flow_found);
           
            var connection = getOracleDBConnection(sync);
            var locationOutput = getListOfSiteNamesOnLocationName_SqlHandler(response,sync,connection);
            var inOperator = "(";
           
            if (locationOutput.rows.length > 0) {
                console.log("site names on location =>" + locationOutput.rows.length);
                for (i = 0; i < locationOutput.rows.length; i++) {

                    inOperator += "'" + locationOutput.rows[i].CI_NAME + "'";

                    if (i < locationOutput.rows.length - 1) {
                        inOperator += ",";
                    }


                }
                inOperator += ")";
                console.log(inOperator);
                var connection = getOracleDBConnectionRemedy(sync);
                var siteName = null;
                var incidentOutput = getIncidentsForIsolatedFaultWithSiteNames_SqlHandler(siteName,inOperator,sync,connection);
                outputText = showIncidentsForRegionBasedOnLocation(incidentOutput.rows, outputText, response, conversationId);
                response = resetEveryThing(response);
            } else {

                outputText = "<b>Sorry the entered location is not found.</b><br/>";// + response.output.text[0];
            }


            if (response.output != null) {
                response.output.text = outputText;
                response = resetEveryThing(response);
            }

        }
        return response;
    }

    /**
     * Description
     * @method technologyTypeFlowWithContext
     * @param {} response
     * @param {} sync
     * @param {} conversationId
     * @return response
     */
    this.technologyTypeFlowWithContext = function (response, sync, conversationId) {

        // transmission location flow : intent
        if (response != null && response.context.cxt_location_name_trx_flow != null) {
            console.log("\ntechnologyTypeFlowWithContext\n");
            var connection = getOracleDBConnectionRemedy(sync);
            var locationOutput = getListOfSiteNamesOnLocationName_SqlHandler(response,sync,connection);

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
              

                var connection = getOracleDBConnectionRemedy(sync);
                var incidentOutput = getListOfIncidentsonTechType_SqlHandler(response,sync,connection);//getOracleQueryResult(connection, incidentSql, sync);
                var outputText = '';
                outputText = showIncidentsForTransmissionFailureOnLocation(incidentOutput.rows, response, conversationId);
                if (response.output != null) {
                    response.output.text = outputText;
                }
                response = resetEveryThing(response);

            } else {
                // location not found.
                response = resetEveryThing(response);
            }


        }

        return response;

    }

    /**
     * Description
     * @method corporateCustomerFlowWithContext
     * @param {} response
     * @param {} sync
     * @return response
     */
    this.corporateCustomerFlowWithContext = function (response, sync) {

        if (response != null && response.context.cxt_matched_customer_count > 1 && response.entities != null && response.entities[0] != null && response.entities[0].entity == 'yes' && response.context.cxt_customer_drill_down_region == null) {
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

                console.log("response.output corporateCustomerFlowWithContext=>" + JSON.stringify(response.output));

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


        if (response != null && response.context.cxt_customer_show_incident_data && response.context.node_output_query != null) {
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
                var connection = getOracleDBConnectionRemedy(sync);
                nodeOutput = getListOfIncidentsForCustomerNodes_SqlHandler(nodeId,output,sync,connection);
                
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
            console.log("response.output => corporateCustomerFlowWithContext=>" + JSON.stringify(response.output));
            //console.log("response.output.text[1]=>" + JSON.stringify(response.output.text[1]));
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

        } else if (response != null && response.context.node_output_query != null && response.entities != null && response.entities[0] != null && response.entities[0].entity == 'No') {
            // clearing context for corporate customer
            console.log("clearing context for corporate customer");
            response = resetEveryThing(response);

        }

        return response;


    }

    /**
     * Description
     * @method userLoginWithContext
     * @param {} response
     * @param {} sync
     * @return response
     */
    this.userLoginWithContext = function (response, sync) {

        if (response != null && response.context != null && !response.context.cxt_user_logged_in && response.context.cxt_verify_user) {

            console.log("verifying user credentials");

            if (response.context.cxt_user_email != null && response.context.cxt_user_password != null) {

                var loginOutPut = userLogin_SqlHandler(response);
                //console.log("loginOutPut=>"+JSON.stringify(loginOutPut));
                if (loginOutPut != null && loginOutPut.data != null && loginOutPut.data.rows && loginOutPut.data.rows.length != 0) {
                    console.log("credentials verified");
                    response.context.cxt_user_logged_in = true;
                    response.context.cxt_userId = loginOutPut.data.rows[0].id;
                    response.context.cxt_user_full_name = loginOutPut.data.rows[0].first_name + " " + loginOutPut.data.rows[0].last_name;
                    userFullName = response.context.cxt_user_full_name;


                } else {
                    console.log("credentials not verified");
                    response.context.cxt_user_email = null;
                    response.context.cxt_user_password = null;
                    response.context.cxt_user_logged_in = false;
                    response.context.cxt_verify_user = false;
                    response.context.cxt_userId = -1;
                    response.context.cxt_user_full_name = null;
                }

                response = getWatsonResponse(response, sync, "yes");

            }


        }
        return response;
    }

};
