module.exports = function () {
    /**
     * This validator will contain all functions that will decide which intent / entity is actually detected when multiple entities are returned
     * This validator will decide on the basis of context variables and entities to return the valid intent hit by user.
     */

    this.sitesIntentClassifier = function (data) {
        var isValidSitesIntent = true;
        var siteNodePattern = false;
        var siteNamePattern = false;
        var returnArray = [];
        console.log("data.entities.length=>" + data.entities.length);
        if (data != null && data.entities != null) {

            for (i = 0; i < data.entities.length; i++) {


                if (data.entities[i] != null && data.entities[i].entity == 'sites-node-pattern') {
                    siteNodePattern = true;
                    returnArray['siteNodePattern'] = siteNodePattern;
                }
                if (data.entities[i] != null && data.entities[i].entity == 'site-names-pattern') {
                    siteNamePattern = true;
                    returnArray['siteNamePattern'] = siteNamePattern;
                }

            }
            /*for (i = 0; i < data.intents.length; i++) {

                if (data.intents[i] != null && data.intents[i].intent == 'incident') {
                    isValidSitesIntent = false;
                }

            }*/
        }
        if (data.context != null && data.context.cxt_ci_flow_site_name == null) {
            isValidSitesIntent = false;
        }
        if (isValidSitesIntent) {
            console.log("isValidSitesIntent=>" + isValidSitesIntent);
        }
        returnArray['isValidSitesIntent'] = isValidSitesIntent;
        return returnArray;


    }

    this.techTypeIntentClassifier = function (data) {
        var returnArray = [];
        var validTransmissionFailureIntent = false;
        var tier_cause_search_term = null;
        var regionNameFound = false;
        if (data != null && data.entities != null && data.intents != null) {



            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && data.entities[i].entity == 'transmission-failures') {
                    tier_cause_search_term = data.entities[i].value;
                    validTransmissionFailureIntent = true;
                }

                if (data.entities[i] != null && data.entities[i].entity == 'regions') {
                    regionNameFound = true;

                }
            }

            if (regionNameFound && tier_cause_search_term != null) {
                validTransmissionFailureIntent = true;
            }

            if (data.context != null && data.context.cxt_matched_customer_count > 0) {
                validTransmissionFailureIntent = false;
            }
            if (data.intents[0] != null && data.intents[0].intent == 'corporate-customer') {
                validTransmissionFailureIntent = false;
            }
        }
        if (validTransmissionFailureIntent) {
            console.log("\nvalidTransmissionFailureIntent=>" + validTransmissionFailureIntent);
        }
        returnArray['validTransmissionFailureIntent'] = validTransmissionFailureIntent;
        returnArray['tier_cause_search_term'] = tier_cause_search_term;
        return returnArray;
    }

    this.regionIntentClassifier = function (data) {

        var returnArray = [];
        var isValidRegionIntentCase = true;
        var regionName = null;

        if (data != null && data.entities != null && data.context != null) {

            if (!data.context.cxt_region_show_isolated_fault && data.context.cxt_location_name_region_flow == null) {
                isValidRegionIntentCase = true;
            } else {
                isValidRegionIntentCase = false;
            }

            if (data.entities.length == 0) {
                isValidRegionIntentCase = false;
            }


            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i].entity == 'regions' || data.entities[i].entity == "sys-location") {
                    regionName = data.entities[i].value;
                    isValidRegionIntentCase = true;
                }

                // check if site name contains region name
                if (data.entities[i].entity == 'escalation' || data.entities[i].entity == "2g-sites" || data.entities[i].entity == 'sites-node-pattern' || data.entities[i].entity == 'site-names-pattern') {
                    isValidRegionIntentCase = false;
                    break;
                }
                // check if customer name contains region name
                if (data.entities[i].entity == "complex-customers-patterns" || data.entities[i].entity == "complex-corporate-customers" || data.entities[i].entity == "corporate-customers") {
                    isValidRegionIntentCase = false;
                    break;
                }

                if (data.entities[i].entity == "transmission-failures") {
                    isValidRegionIntentCase = false;
                    break;
                }

            }

            if (regionName == null) {
                isValidRegionIntentCase = false;
            }

            if (data.context.cxt_unknown_customer_case != null) {
                isValidRegionIntentCase = false;
            }
            if (data.context.cxt_location_list_trx_failure_query != null) {
                isValidRegionIntentCase = false;
            }
            if (data.context.cxt_region_show_isolated_fault) {
                // this check will handle the case when location name in isolated fault contains region
                isValidRegionIntentCase = false;
            }
            if (data.context.cxt_customer_drill_down_region != null) {
                isValidRegionIntentCase = false;
            }

        }
        if (isValidRegionIntentCase) {
            console.log("isValidRegionIntentCase=>" + isValidRegionIntentCase);
            console.log("regionName=>" + regionName);
        }
        returnArray['regionName'] = regionName;
        returnArray['isValidRegionIntentCase'] = isValidRegionIntentCase;
        return returnArray;

    }

    this.incidentIntentClassifier = function (data, inputText) {
        var returnArray = [];
        var isValidIncidentIntent = false;
        var incidentNumber = false;
        var customerNameDetected = false;
        if (data != null && data.entities != null) {

            for (i = 0; i < data.entities.length; i++) {

                if (data.entities[i] != null && (data.entities[i].entity == 'complex-customers-patterns' || data.entities[i].entity == 'complex-corporate-customers' || data.entities[i].entity == 'corporate-customers' || data.entities[i].entity == '2g-sites')) {
                    isValidIncidentIntent = false;
                    customerNameDetected = true;
                    break;
                }
                if (data.intents[i] != null && (data.intents[i].intent == "sites" || data.intents[i].intent == "regions")) {
                    isValidIncidentIntent = false;
                    break;
                }
                if (data.entities[i].entity == "2g-sites" || data.entities[i].entity == 'sites-node-pattern' || data.entities[i].entity == 'site-names-pattern') {
                    isValidIncidentIntent = false;
                    break;
                }
                if (data.entities[i] != null && data.entities[i].entity == "incidents") {
                    isValidIncidentIntent = true;
                    incidentNumber = data.context.cxt_incident_number_to_search;
                }
                if (data.intents[i] != null && data.intents[i].intent == "incident" && data.intents[i].confidence > 0.5) {
                    isValidIncidentIntent = true;
                }
                /*if (data.entities[i].entity == 'sys-number') {
                    console.log("incident number matched by entity sys-number");
                    incidentNumber = data.entities[i].value;
                    isValidIncidentIntent = true;
                }*/


            }
            /*if (inputText != null) {
                regexTest = inputText.match(/[incINC]*([0-9])+/i);
                if (regexTest != null) {
                    console.log("incident number matched by regular expression");
                    incidentNumber = regexTest[0];
                }
            }*/
            //console.log("incidentNumber=>" + JSON.stringify(incidentNumber));
            if (incidentNumber && data.context.cxt_location_name_trx_flow == null && data.context.cxt_tx_name == null && data.context.cxt_region_name == null && data.context.cxt_matched_customer_count == 0 && data.context.cxt_ci_flow_site_name == null) {
                isValidIncidentIntent = true;
            } else {
                isValidIncidentIntent = false;
            }

            if (customerNameDetected || data.context.cxt_site_flow_found) {
                isValidIncidentIntent = false;
            }
        }
        if (isValidIncidentIntent) {
            console.log("isValidIncidentIntent=>" + isValidIncidentIntent);
            console.log("incidentNumber=>" + JSON.stringify(incidentNumber));
        }

        returnArray['isValidIncidentIntent'] = isValidIncidentIntent;
        returnArray['incidentNumber'] = incidentNumber;
        return returnArray;
    }

    this.customerIntentClassifier = function (data) {
        var returnArray = [];
        var isValidCustomerIntent = false;
        var customerCount = 0;
        var customerList = [];
        var regionName = null;
        var inOperatorCustomer = '';
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

            if (data.context != null && data.context.cxt_customer_drill_down_region != null) {
                isValidCustomerIntent = true;
                regionName = data.context.cxt_customer_drill_down_region;
            }
            if (data.context != null && data.context.cxt_location_list_trx_failure_query != null) {
                isValidCustomerIntent = false;
            }
            if (data.context != null && data.context.cxt_customer_flow_found) {
                isValidCustomerIntent = true;
            }
        }
        if (isValidCustomerIntent) {
            console.log("isValidCustomerIntent=>" + isValidCustomerIntent);
            console.log("customerCount=>" + JSON.stringify(customerCount));
        }

        returnArray['isValidCustomerIntent'] = isValidCustomerIntent;
        returnArray['regionName'] = regionName;
        returnArray['customerCount'] = customerCount;
        returnArray['inOperatorCustomer'] = inOperatorCustomer;
        returnArray['customerList'] = customerList;
        returnArray['complexCustomerNameByPatternList'] = complexCustomerNameByPatternList

        return returnArray;
    }


};