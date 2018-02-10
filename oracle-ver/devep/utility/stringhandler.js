module.exports = function () {
    var S = require('string');
    this.correctIncidentNumberFormat = function (incidentNumber) {
        var correctIncidentNumber = null;
        incidentNumber = S(incidentNumber).trim().s;
        incidentNumber = S(incidentNumber).replaceAll('INC', '').s;
        incidentNumber = incidentNumber.replace(/^0+/, '');
        return "INC" + S(incidentNumber).padLeft(12, '0').s;
    }

    this.containsValue = function (arr, val) {
        var valExist = false;
        for (i = 0; i < arr.length; i++) {

            if (arr[i] == val) {
                valExist = true;
                break;
            }

        }
        return valExist;

    }
    this.getRandomInt = function () {
        min = Math.ceil(99);
        max = Math.floor(99999);
        return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }
    this.handleDigitsWithSlashInCustomerName = function (customerName) {
        customerName = S(customerName).replaceAll('0/', 'zero/').s;
        customerName = S(customerName).replaceAll('/0', '/zero').s;
        customerName = S(customerName).replaceAll('1/', 'one/').s;
        customerName = S(customerName).replaceAll('/1', '/one').s;
        customerName = S(customerName).replaceAll('2/', 'two/').s;
        customerName = S(customerName).replaceAll('/2', '/two').s;
        customerName = S(customerName).replaceAll('3/', 'three/').s;
        customerName = S(customerName).replaceAll('/3', '/three').s;
        customerName = S(customerName).replaceAll('4/', 'four/').s;
        customerName = S(customerName).replaceAll('/4', '/four').s;
        customerName = S(customerName).replaceAll('5/', 'five/').s;
        customerName = S(customerName).replaceAll('/5', '/five').s;
        customerName = S(customerName).replaceAll('6/', 'six/').s;
        customerName = S(customerName).replaceAll('/6', '/six').s;
        customerName = S(customerName).replaceAll('7/', 'seven/').s;
        customerName = S(customerName).replaceAll('/7', '/seven').s;
        customerName = S(customerName).replaceAll('8/', 'eight/').s;
        customerName = S(customerName).replaceAll('/8', '/eight').s;
        customerName = S(customerName).replaceAll('9/', 'nine/').s;
        customerName = S(customerName).replaceAll('/9', '/nine').s;
        customerName = S(customerName).replaceAll('L2', 'Ltwo').s;
        return customerName;

    }
    this.restoreDigitsWithSlashInCustomerName = function (customerName) {
        customerName = S(customerName).replaceAll('zero/', '0/').s;
        customerName = S(customerName).replaceAll('/zero', '/0').s;
        customerName = S(customerName).replaceAll('one/', '1/').s;
        customerName = S(customerName).replaceAll('/one', '/1').s;
        customerName = S(customerName).replaceAll('two/', '2/').s;
        customerName = S(customerName).replaceAll('/two', '/2').s;
        customerName = S(customerName).replaceAll('three/', '3/').s;
        customerName = S(customerName).replaceAll('/three', '/3').s;
        customerName = S(customerName).replaceAll('four/', '4/').s;
        customerName = S(customerName).replaceAll('/four', '/4').s;
        customerName = S(customerName).replaceAll('five/', '5/').s;
        customerName = S(customerName).replaceAll('/five', '/5').s;
        customerName = S(customerName).replaceAll('six/', '6/').s;
        customerName = S(customerName).replaceAll('/six', '/6').s;
        customerName = S(customerName).replaceAll('seven/', '7/').s;
        customerName = S(customerName).replaceAll('/seven', '/7').s;
        customerName = S(customerName).replaceAll('eight/', '8/').s;
        customerName = S(customerName).replaceAll('/eight', '/8').s;
        customerName = S(customerName).replaceAll('nine/', '9/').s;
        customerName = S(customerName).replaceAll('/nine', '/9').s;
        customerName = S(customerName).replaceAll('Ltwo', 'L2').s;
        return customerName;


    }
    this.resetCustomerContext = function (data) {
        data.context.cxt_show_customer_selected_name = null;
        data.context.cxt_matched_customer_name = null;
        data.context.cxt_customer_flow_found = null;
        data.context.cxt_customer_query = null;
        data.context.cxt_matched_customer_count = 0;
        data.context.cxt_customer_flow_node_detail_query_executed = false;
        data.context.cxt_customer_show_incident_data = false;
        data.context.cxt_user_selected_customer = null;
        data.context.cxt_customer_drill_down_region = null;
        data.context.node_output_query = null;
        //  data.context.cxt_customer_input_text = null;
        data.context.cxt_customer_region_list_query = null;
        data.context.cxt_unknown_input = null;
        data.context.cxt_complex_customer = null;
        data.context.cxt_complex_customer_case = false;
        data.context.cxt_user_selected_customer = null;
        data.context.cxt_plain_customer_name_case = false;
        return data;
    }
    this.resetIncidentContext = function (data) {
        data.context.cxt_show_incident_details = false;
        data.context.cxt_parent_incident_number = -1;
        data.context.cxt_is_master_incident = false;
        data.context.cxt_child_incident_count = 0;
        data.context.cxt_parent_incident_number = -1;
        return data;
    }
    this.resetRegionContext = function (data) {
        data.context.cxt_region_name = null;
        data.context.cxt_region_full_name = null;
        data.context.cxt_location_name_region_flow = null;
        data.context.cxt_region_show_isolated_fault = false;
        data.context.cxt_region_show_master_incident = false;
        data.context.cxt_site_name_region_flow_found = null;
        data.context.cxt_site_name_region_flow = null;
        data.context.cxt_region_flow_search_for_location = false;
        data.context.cxt_location_name_region_flow_found = false;
        data.context.cxt_location_name_region_flow = null;
        return data;
    }
    this.resetSitesContext = function (data) {
        data.context.cxt_site_flow_found = false;
        data.context.cxt_ci_flow_site_name = null;
        data.context.cxt_ci_flow_show_incident = false;
        data.context.cxt_ci_site_name_found_in_db = false;
        return data;
    }
    this.resetTransmissionFailureContext = function (data) {
        data.context.cxt_tx_name = null;
        data.context.cxt_tx_found_incident_count = 0;
        data.context.cxt_location_list_trx_failure_query = null;
        data.context.cxt_location_name_trx_flow_found = false;
        data.context.cxt_location_name_trx_flow = null;
        data.context.cxt_tech_type_region = null;
        data.context.cxt_tech_type_region_full_name = null;
        return data;
    }

    this.resetEveryThing = function (data) {
        data = resetCustomerContext(data);
        data = resetIncidentContext(data);
        data = resetRegionContext(data);
        data = resetSitesContext(data);
        data = resetTransmissionFailureContext(data);
        return data;
    }

    this.getCorrectComplexCustomerNameFromPatternMatching = function (customerList) {
        /**
         * The pattern matching technique is using multiple regular expressions so in some cases watson matches multiple
         * literals for one complex customer name. This method will pick the customer name that will be longest in length.
         * The largest in length will be the correct match by pattern matcher.
         */
        var validCustomerName = null;
        var customerNameLength = 0;
        for (i = 0; i < customerList.length; i++) {

            if (customerList[i].length > customerNameLength) {
                customerNameLength = customerList[i].length;
                validCustomerName = customerList[i];
            }

        }

        return validCustomerName;

    }



};
