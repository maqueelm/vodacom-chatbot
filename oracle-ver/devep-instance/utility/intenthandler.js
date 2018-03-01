/**
 * Description
 * @method exports
 * @return
 * Intent Handler will handle preliminary logic before calling orchestrator to actually fill up watson returned template with data from database. 
 * Intent handler uses intentClassifier to classify intents when input triggers multiple entities like certain customer names contains site names. 
 */
module.exports = function () {
       
    require('./stringhandler')();
    require('./intentclassifier')();
    require('./sqlhandler')();
    require('./watsonentityhandler')();
    var S = require('string');
    var striptags = require('striptags');

    /**
     * Description
     * @method handleSitesIntent
     * @param {} data
     * @param {} inputText
     * @param {} outputText
     * @param {} sync
     * @return data
     */
    this.handleSitesIntent = function (data, inputText, outputText, sync) {

        var returnArray = sitesIntentClassifier(data);
        var isValidSitesIntent = returnArray['isValidSitesIntent'];
        var siteNodePattern = returnArray['siteNodePattern'];
        var siteNamePattern = returnArray['siteNamePattern'];

        if (data.context != null && data.context.cxt_ci_flow_site_name != null && isValidSitesIntent) {
            console.log("handleSitesIntent");
            console.log("data.context.cxt_ci_flow_site_name=>" + data.context.cxt_ci_flow_site_name);
            var connection = getOracleDBConnectionRemedy(sync);
            if (connection) {

                lookForSiteNamesData = siteNameExists_SqlHandler(data, sync, connection);

                if (lookForSiteNamesData != null && lookForSiteNamesData.rows.length > 0) {
                    console.log("site name found in db");
                    data.context.cxt_ci_site_name_found_in_db = true;
                    console.log("siteNodePattern=>" + siteNodePattern);
                    if (siteNodePattern || siteNamePattern) {
                        // add this node in watson learning for sitenames
                        console.log("Adding to 2g-sites entity=>" + data.context.cxt_ci_flow_site_name);
                        createEntityValue(data.context.cxt_ci_flow_site_name, "2g-sites");
                    }

                } else {
                    console.log("site name not found in db");
                    data.output.text = "Site name <b>not</b> found. Would you like to do another search? Reply with <b><a href='#' id='yes' onclick='copyToTypingArea(this);' title='Click here to paste text in typing area' >Yes</a> </b>.";
                    data = resetEveryThing(data);
                }
                console.log("data.context.cxt_ci_flow_show_incident=>" + data.context.cxt_ci_flow_show_incident);
                if (data.context.cxt_ci_site_name_found_in_db && data.context.cxt_ci_flow_show_incident) {
                    var connection = getOracleDBConnectionRemedy(sync);
                    if (connection) {
                        incidentResult = getIncidentListOnSite_SqlHandler(data, sync, connection);
                        data = showIncidentsForSiteName(incidentResult.rows, outputText, data, data.context.conversation_id);
                        data = resetEveryThing(data);
                    } else {
                        data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
                        data = resetEveryThing(data);
                    }
                }
            } else {
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }
        }
        return data;
    }

    /**
     * Description
     * @method handleTransmissionFailureIntent
     * @param {} data
     * @param {} inputText
     * @param {} outputText
     * @param {} sync
     * @return data
     */
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

                var regionFullName = '';

                if (data.context.cxt_tech_type_region != null) {

                    var lookupResult = regionLookUp_SqlHandler(data.context.cxt_tech_type_region);

                    if (lookupResult != null && lookupResult.data != null && lookupResult.data.rows != null && lookupResult.data.rows.length > 0) {
                        if (lookupResult.data.rows.length == 1) {
                            regionFullName = "'" + lookupResult.data.rows[0].full_name.toLowerCase() + "'";
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
                    // locatoinForFailureSql += " and LOWER(inc.region) IN (" + regionFullName.toLowerCase() + ")";
                    data.context.cxt_tech_type_region_full_name = regionFullName;
                }

                var locatoinForFailureSql = locationFailureSql_SqlHandler(data, regionFullName);
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
                        var locationSql = getLocationsForSiteNames_SqlHandler(inOperator, data);
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

    /**
     * Description
     * @method handleCustomerIntent
     * @param {} data
     * @param {} inputText
     * @param {} outputText
     * @param {} sync
     * @return data
     */
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
            data.context.cxt_matched_customer_count = customerCount;
            if (data.context.cxt_plain_customer_name_case) {

                console.log("\nCustomer detected by @corporate-customer entity only.\n");
                console.log("\ndata.context.cxt_customer_input_text=>" + data.context.cxt_customer_input_text);
                if (customerCount == 1) {
                    customerInputText = data.context.cxt_customer_input_text;
                }
                if (customerInputText == null) {

                    if (S(inOperatorCustomer).count(",") > 0) {
                        customerSql += " where MPLSVPN_NAME in  (" + inOperatorCustomer + ")  AND IFACE_VLANID > 0 ";
                        data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where MPLSVPN_NAME in  (" + inOperatorCustomer + ") AND IFACE_VLANID > 0";
                    } else {
                        inOperatorCustomer = S(inOperatorCustomer).replaceAll("'", '').s; // replacing space with % for like query
                        inOperatorCustomer = S(inOperatorCustomer).replaceAll(' ', '%').s; // replacing space with % for like query
                        customerSql += " where LOWER(MPLSVPN_NAME) like '%" + inOperatorCustomer.toLowerCase() + "%' AND IFACE_VLANID > 0";
                        data.context.cxt_customer_region_list_query = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where LOWER(MPLSVPN_NAME) like '%" + inOperatorCustomer.toLowerCase() + "%' AND IFACE_VLANID > 0";
                    }


                } else {
                    data.context.cxt_customer_input_text = customerInputText;
                    customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query
                    customerSql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
                    data.context.cxt_customer_region_list_query = getCustomerRegionListQuery_SqlHandler(customerInputText);
                }
            }

            if (data.context != null && data.context.cxt_complex_customer_pattern_case && !data.context.cxt_complex_customer_case && !data.context.cxt_plain_customer_name_case) {
                /* handle here when customer name matches only pattern and nothing else. Things to do then
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
        data = handleUnknownCustomerIntent(data, sync);

        return data;

    }

    /**
     * Description
     * @method handleUnknownCustomerIntent
     * @param {} data
     * @param {} sync
     * @return data
     */
    this.handleUnknownCustomerIntent = function (data, sync) {


        if (data != null && data.context != null && data.context.cxt_customer_input_text != null && data.context.cxt_location_list_trx_failure_query == null && data.context.cxt_unknown_customer_case && !data.context.cxt_plain_customer_name_case && data.context.cxt_user_selected_customer == null) {
            console.log("handleUnknownCustomerIntent");

            /**
             * If there is any entity coming as yes with unknown corporate customer flow we need to set that as no in order to skip the next steps from executing before 
             * user input yes for coporate customer intent.
             */
            if (data.entities != null && data.entities[0] != null && data.entities[0].entity == 'yes') {
                data.entities[0].entity = 'No';
            }

            if (data.context.cxt_customer_input_text != null) {
                customerInputText = data.context.cxt_customer_input_text;
            }
            if (data.context.cxt_unknown_input != null) {
                customerInputText = data.context.cxt_unknown_input;
            }
            customerInputText = S(customerInputText).replaceAll(' ', '%').s; // replacing space with % for like query

            var sql = getSQLForUnknownCustomer_SqlHandler(customerInputText);
            data.context.cxt_customer_region_list_query = getCustomerRegionListQuery_SqlHandler(customerInputText);

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
                console.log("customerCount for unknown customer=>" + JSON.stringify(customerCount));
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

    /**
     * Description
     * @method handleRegionIntent
     * @param {} data
     * @param {} inputText
     * @param {} outputText
     * @param {} sync
     * @return data
     */
    this.handleRegionIntent = function (data, inputText, outputText, sync) {
        var returnArray = regionIntentClassifier(data);
        var isValidRegionIntentCase = returnArray['isValidRegionIntentCase'];
        var regionName = returnArray['regionName'];;

        if (isValidRegionIntentCase) {
            var fullName = "";
            var regionFullName = '';
            var lookupResult = regionLookUp_SqlHandler(regionName);
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
            }
            data.context.cxt_region_name = regionName;
            data.context.cxt_region_full_name = regionFullName;
            data = orchestrateBotResponseTextForRegion(data, sync);
        }

        return data;

    }

    /**
     * Description
     * @method handleIncidentIntent
     * @param {} data
     * @param {} inputText
     * @param {} sync
     * @return data
     */
    this.handleIncidentIntent = function (data, inputText, sync) {

        var returnArray = incidentIntentClassifier(data, inputText);
        var isValidIncidentIntent = returnArray['isValidIncidentIntent'];
        var incidentNumber = returnArray['incidentNumber'];

        if (isValidIncidentIntent && incidentNumber) {

            var incident_no_str = incidentNumber.toUpperCase();
            incidentNumber = correctIncidentNumberFormat(incident_no_str);

            var connection = getOracleDBConnectionRemedy(sync);
            if (connection) {

                var output = getIncidentDataOnIncidentNumber_SqlHandler(incidentNumber, sync, connection);

                if (output != null && output.rows != null && output.rows.length > 0 && output.rows[0].RELATIONSHIP_TYPE != "Child") {
                    console.log("incident is not child incident");
                    output = getIncidentDataWithTaskInfo_SqlHandler(incidentNumber, sync, connection);
                    if (output.rows.length == 0) {
                        output = getIncidentDataOnIncidentNumber_SqlHandler(incidentNumber, sync, connection);
                    }

                } else {
                    console.log("incident is child incident");
                    output = getIncidentDataOnIncidentNumber_SqlHandler(incidentNumber, sync, connection);
                }


                if (output != null && output.rows != null && output.rows.length > 0) {
                    var connection = getOracleDBConnectionRemedy(sync);
                    if (connection) {
                        var childCount = getCountOfChildIncident_SqlHandler(incidentNumber, sync, connection);
                        data = orchestrateBotResponseTextForIncident(output.rows, data.output.text, data, childCount, sync);
                    }


                } else {
                    data = resetEveryThing(data);
                    data = getWatsonResponse(data, sync,null);
                    var temp = data.output.text[0];
                    data.output.text[0] = "<b>Sorry, no result can be found against given incident number " + incidentNumber + " in remedy. Please provide with a different incident number.</b>";
                    data.output.text[1] = temp;
                }
                doRelease(connection);

            } else {
                data = resetEveryThing(data);
                data = getWatsonResponse(data, sync,null);
                data.output.text = "<b>Sorry, i could not connect to data source for fetching the requested information. Please try again later.</b>";
            }

        }

        return data;
    }

    /**
     * Description
     * @method handleEscalationIntent
     * @param {} data
     * @param {} inputText
     * @param {} outputText
     * @param {} await
     * @param {} defer
     * @param {} discovery
     * @return data
     */
    this.handleEscalationIntent = function (data, inputText, outputText, await, defer, discovery) {

        if (data != null && data.intents != null && data.intents[0] != null && data.intents[0].intent == "escalation" && data.intents[0].confidence > 0.5 || (data.entities != null && data.entities[0] != null && data.entities[0] == 'escalation')) {
            console.log("handleEscalationIntent");
            inputText = S(inputText).replaceAll('shift', '').s;
            inputText = S(inputText).replaceAll('report', '').s;
            inputText = S(inputText).replaceAll('shiftreport', '').s;
            inputText = S(inputText).replaceAll('major', '').s;
            inputText = S(inputText).replaceAll('escalation', '').s;
            inputText = S(inputText).replaceAll('majorescalation', '').s;
            inputText = S(inputText).replaceAll('incident', '').s;
            console.log("handleEscalationIntent =>" + inputText);
            datadisc = await(discovery.query({ environment_id: process.env.DISCOVERY_ENVIRONMENT_ID, collection_id: process.env.DISCOVERY_COLLECTION_ID, query: inputText, passages: true, count: 10, highlight: true, 'passages.characters': 400 }, defer()));

            console.log(JSON.stringify(datadisc["passages"][0]["passage_text"].length));



            if (datadisc["passages"] != null) {
                var passageText = '';
                outputText = "<b>The top most relevant passages from shift reports are below: </b><br/><br/>";
                for (i = 0; i < datadisc["passages"].length; i++) {

                    if (datadisc["passages"][i] != null) {
                        passageText = datadisc["passages"][i]["passage_text"].replace(/\n/g, "<br/>");
                        outputText += JSON.stringify(passageText, null, 2) + "<br/><hr>";
                    }


                }

            }
            else if (datadisc["results"] != null) {
                outputText = "<b>The top most relevant shift reports are below: </b><br/>";
                for (i = 0; i < datadisc["results"].length; i++) {

                    if (datadisc["results"][i] != null) {
                        outputText += JSON.stringify(striptags(datadisc["results"][i]["contentHtml"].substring(0, 1000), null, 2).replace(/\n/g, "<br/>")) + ".....<br/><a href=" + datadisc["results"][i]["sourceUrl"] + "><b>Click here for document</b></a><br/><br/>";
                    }
                }


            } else {
                // no result found against shift report search
                outputText = "<b>I could not find any relevant passages from shift reports.</b>";
            }
            //console.log(JSON.stringify(datadisc));

            data.output.text[0] = outputText;

        }

        return data;

    }

    
};
