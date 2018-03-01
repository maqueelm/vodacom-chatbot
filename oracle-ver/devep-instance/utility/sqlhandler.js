/**
 * Description
 * @return
 * This handler will have all SQLs used in getting responses from different databases used in this application like Remedy and name_repo.NMG_CHATBOT_MV
 * @method exports
 * @return 
 */
module.exports = function () {

    var incidentTableName = "ARADMIN.HPD_HELP_DESK inc";
    var incidentTableName_2 = "ARADMIN.HPD_HELP_DESK inc_2";
    var taskTable = "ARADMIN.TMS_TASK";
    var incidentTableFieldsWithAlias = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,inc.ASSIGNED_GROUP,inc.RESOLUTION_CATEGORY_TIER_2 as RESOLUTION_CATEGORY_TIER_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

    var incidentTableJoinTaskTable = "inc.INCIDENT_NUMBER,inc.ORIGINAL_INCIDENT_NUMBER as PARENT_INCIDENT_NUMBER,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTSTARTTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_START_TIME,TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (inc.SPE_FLD_ALARMEVENTENDTIME + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as INCIDENT_EVENT_END_TIME,inc.SPE_FLD_ACTUALIMPACT as IMPACT,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,decode(INC.INCIDENT_ASSOCIATION_TYPE,1,'Child',0,'Master',null,'Standalone',INC.INCIDENT_ASSOCIATION_TYPE) as RELATIONSHIP_TYPE,inc.ASSIGNED_GROUP as ASSIGNED_GROUP,inc.ASSIGNEE,tas.ASSIGNEE_GROUP as TASK_ASSIGNEE_GROUP,tas.ASSIGNEE as TASK_ASSIGNEE,tas.TASK_ID as task_id,inc.RESOLUTION_CATEGORY_TIER_2 as resolution_category_tier_2,inc.RESOLUTION_CATEGORY_TIER_3 as RESOLUTION_CATEGORY_TIER_3,inc.GENERIC_CATEGORIZATION_TIER_1 as CAUSE_TIER_1,inc.GENERIC_CATEGORIZATION_TIER_2 as CAUSE_TIER_2 ";

    require('../db/db-mysql.js')();
    /**
     * Description
     * @method userLogin_SqlHandler
     * @param {} response
     * @return loginOutPut
     */
    this.userLogin_SqlHandler = function (response) {

        var loginQuery = "Select id,first_name,last_name from bot_users where email = '" + response.context.cxt_user_email + "' and password = '" + response.context.cxt_user_password + "';";
        //console.log("loginQuery=>"+loginQuery);
        var loginOutPut = executeQuerySync(loginQuery);
        return loginOutPut;
    }

    /**
     * Description
     * @method regionLookUp_SqlHandler
     * @param {} regionName
     * @return lookupResult
     */
    this.regionLookUp_SqlHandler = function (regionName) {

        var regionLookupQuery = "Select * from region_lookup where (LOWER(abbreviation) = '" + regionName.toLowerCase() + "' OR LOWER(full_name) = '" + regionName.toLowerCase() + "')";
        console.log("regionLookUp =>" + regionLookupQuery);
        var lookupResult = executeQuerySync(regionLookupQuery);
        return lookupResult;

    }

    /**
     * Description
     * @method getIncidentListOnSite_SqlHandler
     * @param {} data
     * @param {} sync
     * @param {} connection
     * @return incidentResult
     */
    this.getIncidentListOnSite_SqlHandler = function (data, sync, connection) {

        var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and LOWER(inc.HPD_CI) like '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "%'";
        console.log("\n getIncidentListOnSite=>" + incidentSql);
        // var connection = getOracleDBConnectionRemedy(sync);
        var incidentResult = null;
        if (connection) {
            incidentResult = getOracleQueryResult(connection, incidentSql, sync);
            doRelease(connection);
        }
        return incidentResult;

    }

    /**
     * Description
     * @method siteNameExists_SqlHandler
     * @param {} data
     * @param {} sync
     * @param {} connection
     * @return lookForSiteNamesData
     */
    this.siteNameExists_SqlHandler = function (data, sync, connection) {

        var lookForSiteNames = "SELECT * FROM " + incidentTableName + " WHERE LOWER(HPD_CI) = '" + data.context.cxt_ci_flow_site_name.toLowerCase() + "' AND STATUS in (0,1,2,3)";
        console.log("siteNameExists=>" + lookForSiteNames);
        //var connection = getOracleDBConnectionRemedy(sync);
        var lookForSiteNamesData = null;
        if (connection) {
            lookForSiteNamesData = getOracleQueryResult(connection, lookForSiteNames, sync);
            doRelease(connection);
        }
        return lookForSiteNamesData;
    }

    /**
     * Description
     * @method locationFailureSql_SqlHandler
     * @param {} data
     * @param {} regionFullName
     * @return locatoinForFailureSql
     */
    this.locationFailureSql_SqlHandler = function (data, regionFullName) {
        var locatoinForFailureSql = "Select distinct inc.HPD_CI as SITE_NAME from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3))";
        locatoinForFailureSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";

        locatoinForFailureSql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) = '" + data.context.cxt_tx_name.toLowerCase() + "'";
        if (regionFullName != '') {
            locatoinForFailureSql += " and LOWER(inc.region) IN (" + regionFullName.toLowerCase() + ")";
        }
        console.log("locatoinForFailureSql=>" + locatoinForFailureSql);
        return locatoinForFailureSql

    }

    /**
     * Description
     * @method getLocationsForSiteNames_SqlHandler
     * @param {} inOperator
     * @param {} data
     * @return locationSql
     */
    this.getLocationsForSiteNames_SqlHandler = function (inOperator, data) {

        var locationSql = "SELECT DISTINCT LOCATION_NAME from name_repo.NMG_CHATBOT_MV WHERE CI_NAME IN " + inOperator + " and LOWER(LOCATION_NAME) != 'unknown' and LOWER(LOCATION_NAME) not like 'estimated%'";
        if (data.context.cxt_tech_type_region != null) {
            locationSql += " and LOWER(region) = '" + data.context.cxt_tech_type_region.toLowerCase() + "'";
        }

        locationSql += " order by LOCATION_NAME";

        return locationSql;

    }

    /**
     * Description
     * @method getIncidentDataOnIncidentNumber_SqlHandler
     * @param {} incidentNumber
     * @param {} sync
     * @param {} connection
     * @return incidentOutput
     */
    this.getIncidentDataOnIncidentNumber_SqlHandler = function (incidentNumber, sync, connection) {
        var sql = "SELECT " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
        var incidentOutput = getOracleQueryResult(connection, sql, sync);
        console.log("getIncidentDataOnIncidentNumber_SqlHandler=>" + sql);
        return incidentOutput;
    }

    /**
     * Description
     * @method getIncidentDataWithTaskInfo_SqlHandler
     * @param {} incidentNumber
     * @param {} sync
     * @param {} connection
     * @return incidentOutput
     */
    this.getIncidentDataWithTaskInfo_SqlHandler = function (incidentNumber, sync, connection) {
        var sql = "SELECT * from (SELECT " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and tas.status != '6000' and inc.INCIDENT_NUMBER  = '" + incidentNumber + "') A left join" +
            "(SELECT * FROM (SELECT INCIDENT_NUMBER, DETAILED_DESCRIPTION, work_log_type, TO_CHAR(TO_DATE('1970-01-01', 'YYYY-MM-DD') + (WORK_LOG_DATE + 7200) / 86400,'DD/MON/YYYY HH24:MI:SS') as WORK_LOG_DATE FROM ARADMIN.HPD_WORKLOG where INCIDENT_NUMBER = '" + incidentNumber + "' ORDER BY work_log_date desc) WHERE rownum = 1) B on A.INCIDENT_NUMBER = B.INCIDENT_NUMBER";
        var incidentOutput = getOracleQueryResult(connection, sql, sync);
        return incidentOutput;
    }

    /**
     * Description
     * @method getCountOfChildIncident_SqlHandler
     * @param {} incidentNumber
     * @param {} sync
     * @param {} connection
     * @return childCount
     */
    this.getCountOfChildIncident_SqlHandler = function (incidentNumber, sync, connection) {
        var childsql = "Select count(*) as CHILD_COUNT from " + incidentTableName + " where inc.STATUS in (0,1,2,3)  and inc.ORIGINAL_INCIDENT_NUMBER  = '" + incidentNumber + "' and inc.INCIDENT_ASSOCIATION_TYPE = 1";
        var childoutput = getOracleQueryResult(connection, childsql, sync);
        var childCount = 0;
        if (childoutput != null && childoutput.rows != null) {
            childCount = childoutput.rows[0].CHILD_COUNT;
        }
        return childCount;
    }

    /**
     * Description
     * @method getChildIncidentForMaster_SqlHandler
     * @param {} incidentNumber
     * @param {} sync
     * @param {} connection
     * @return childoutput
     */
    this.getChildIncidentForMaster_SqlHandler = function (incidentNumber, sync, connection) {
        var childsql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.STATUS in (0,1,2,3) and inc.ORIGINAL_INCIDENT_NUMBER  = '" + incidentNumber + "'";
        console.log("getChildIncidentForMaster_SqlHandler=>" + childsql);
        var childoutput = getOracleQueryResult(connection, childsql, sync);
        doRelease(connection);
        return childoutput;
    }

    /**
     * Description
     * @method getParentIncidentDetails_SqlHandler
     * @param {} incidentNumber
     * @param {} sync
     * @param {} connection
     * @return incidentOutput
     */
    this.getParentIncidentDetails_SqlHandler = function (incidentNumber, sync, connection) {
        var sql = "Select " + incidentTableJoinTaskTable + " from " + incidentTableName + " join " + taskTable + " tas on inc.incident_number = tas.ROOTREQUESTID where inc.STATUS in (0,1,2,3) and inc.INCIDENT_NUMBER  = '" + incidentNumber + "'";
        console.log("getParentIncidentDetails_SqlHandler =>" + sql);
        var incidentOutput = getOracleQueryResult(connection, sql, sync);
        return incidentOutput;
    }

    /**
     * Description
     * @method getSQLForUnknownCustomer_SqlHandler
     * @param {} customerInputText
     * @return sql
     */
    this.getSQLForUnknownCustomer_SqlHandler = function (customerInputText) {

        var sql = "Select DISTINCT MPLSVPN_NAME,IFACE_VLANID from  tellabs_ods.ebu_vlan_status_mv";
        sql += " where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
        console.log("getSQLForUnknownCustomer_SqlHandler =>" + sql);
        return sql;

    }

    /**
     * Description
     * @method getCustomerRegionListQuery_SqlHandler
     * @param {} customerInputText
     * @return sql
     */
    this.getCustomerRegionListQuery_SqlHandler = function (customerInputText) {
        var sql = "Select DISTINCT REGION from  tellabs_ods.ebu_vlan_status_mv  where LOWER(MPLSVPN_NAME) like '%" + customerInputText.toLowerCase() + "%' AND IFACE_VLANID > 0";
        return sql;

    }

    /**
     * Description
     * @method getMasterIncidentsWithNoChildAssociation_SqlHandler
     * @param {} regionFullName
     * @param {} sync
     * @param {} connection
     * @return masterIncidentsDetailsResult
     */
    this.getMasterIncidentsWithNoChildAssociation_SqlHandler = function (regionFullName, sync, connection) {
        // if no master found with child association list all masters that are found for the region.
        var sql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)";
        sql += " AND inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        sql += " AND LOWER(inc.region) IN (" + regionFullName + ")";
        console.log("getMasterIncidentsWithNoChildAssociation =>" + sql);
        var masterIncidentsDetailsResult = getOracleQueryResult(connection, sql, sync);
        doRelease(connection);
        return masterIncidentsDetailsResult;

    }

    /**
     * Description
     * @method getMasterIncidentsWithChildAssociation_SqlHandler
     * @param {} regionFullName
     * @param {} sync
     * @param {} connection
     * @return masterIncidentsDetailsResult
     */
    this.getMasterIncidentsWithChildAssociation_SqlHandler = function (regionFullName, sync, connection) {
        // if master found with child association list all masters that are found for the region.
        var sql = "Select distinct inc.INCIDENT_NUMBER,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS,inc.ORIGINAL_INCIDENT_NUMBER AS PARENT_INCIDENT_NUMBER,inc.HPD_CI AS SITE_NAME,inc.DESCRIPTION AS SUMMARY,inc.REGION from " + incidentTableName + " inner join " + incidentTableName_2 + " on ( inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3)) ";
        sql += " AND inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        sql += " AND LOWER(inc.REGION) IN (" + regionFullName + ")";
        console.log("getMasterIncidentsWithChildAssociation_SqlHandler =>" + sql);
        var masterIncidentsDetailsResult = getOracleQueryResult(connection, sql, sync);
        doRelease(connection);
        return masterIncidentsDetailsResult;

    }

    /**
     * Description
     * @method getListOfSiteNamesBasedOnRegion_SqlHandler
     * @param {} regionFullName
     * @param {} sync
     * @param {} connection
     * @return listOfSitesOutput
     */
    this.getListOfSiteNamesBasedOnRegion_SqlHandler = function (regionFullName, sync, connection) {
        var sql = "SELECT distinct HPD_CI as SITE_NAME FROM " + incidentTableName + " WHERE LOWER(region) IN (" + response.context.cxt_region_full_name + ") AND STATUS in (0,1,2,3) ";
        sql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        console.log("getListOfSiteNamesBasedOnRegion_SqlHandler =>" + sql);
        var listOfSitesOutput = getOracleQueryResult(connection, sql, sync);
        doRelease(connection);
        return listOfSitesOutput;

    }

    /**
     * Description
     * @method getIncidentsForIsolatedFaultWithSiteNames_SqlHandler
     * @param {} siteName
     * @param {} inOperator
     * @param {} sync
     * @param {} connection
     * @return incidentOutput
     */
    this.getIncidentsForIsolatedFaultWithSiteNames_SqlHandler = function (siteName, inOperator, sync, connection) {
        var incidentOutput = null;
        if (siteName != null) {

            var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where HPD_CI = '" + siteName + "' and status in (0,1,2,3)";
            incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
            console.log("getIncidentsForIsolatedFaultWithSiteNames_SqlHandler=>" + incidentSql);
            incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
            doRelease(connection);


        }
        if (inOperator != null) {
            var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where HPD_CI in " + inOperator + " and status in (0,1,2,3)";
            incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
            console.log("getIncidentsForIsolatedFaultWithSiteNames_SqlHandler=>" + incidentSql);
            var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
            doRelease(connection);

        }
        return incidentOutput;

    }

    /**
     * Description
     * @method getListOfSiteNamesOnLocationName_SqlHandler
     * @param {} response
     * @param {} sync
     * @param {} connection
     * @return locationOutput
     */
    this.getListOfSiteNamesOnLocationName_SqlHandler = function (response, sync, connection) {
        var locationName = null;
        if (response.context.cxt_location_name_region_flow != null) {
            locationName = response.context.cxt_location_name_region_flow.toLowerCase();
        }
        if (response.context.cxt_location_name_trx_flow != null) {
            locationName = response.context.cxt_location_name_trx_flow.toLowerCase();
        }
        var locationSql = "SELECT * from name_repo.NMG_CHATBOT_MV WHERE LOWER(LOCATION_NAME) = '" + locationName + "' and ROWNUM < 1000";
        console.log("location query from context variable =>" + locationSql);
        var locationOutput = getOracleQueryResult(connection, locationSql, sync);
        doRelease(connection);
        return locationOutput;
    }

    /**
     * Description
     * @method getListOfIncidentsonTechType_SqlHandler
     * @param {} response
     * @param {} sync
     * @param {} connection
     * @return incidentOutput
     */
    this.getListOfIncidentsonTechType_SqlHandler = function (response, sync, connection) {
        var incidentSql = "Select " + incidentTableFieldsWithAlias + " from " + incidentTableName + " where inc.HPD_CI in " + inOperator + " and INC.INCIDENT_ASSOCIATION_TYPE = 0 AND inc.status in (0,1,2,3)";
        incidentSql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        if (response.context.cxt_tx_name != null) {
            incidentSql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) = '" + response.context.cxt_tx_name.toLowerCase() + "' ";
        }
        var incidentOutput = getOracleQueryResult(connection, incidentSql, sync);
        doRelease(connection);
        console.log("incident sql =>" + incidentSql);
        return incidentOutput;
    }

    /**
     * Description
     * @method getListOfIncidentsForCustomerNodes_SqlHandler
     * @param {} nodeId
     * @param {} output
     * @param {} sync
     * @param {} connection
     * @return nodeOutput
     */
    this.getListOfIncidentsForCustomerNodes_SqlHandler = function (nodeId, output, sync, connection) {

        var nodeSql = "Select inc.INCIDENT_NUMBER,inc.REGION,inc.HPD_CI as SITE_NAME,inc.DESCRIPTION as SUMMARY,decode(inc.STATUS,0,'New',1,'Assigned',2,'In Progress',3,'Pending',4,'Resolved',5,'Closed',6,'Cancelled',inc.STATUS) as INC_STATUS from ARADMIN.HPD_HELP_DESK inc where inc.STATUS in (0,1,2,3) and (inc.HPD_CI in('NODE" + nodeId + "'";
        for (j = 1; j < output.rows.length; j++) {
            nodeId = output.rows[j].NID;
            nodeSql += " , 'NODE" + nodeId + "'"
        }
        nodeSql += "))";
        console.log(nodeSql);
        var nodeOutput = getOracleQueryResult(connection, nodeSql, sync);
        doRelease(connection);
        return nodeOutput;
    }

    /**
 * Description
 * @method getChildIncidentCountForRegion_SqlHandler
 * @param {} data
 * @param {} sync
 * @param {} connection
 * @return childIncidentCount
 */
    this.getChildIncidentCountForRegion_SqlHandler = function (data, sync, connection) {
        var childIncidentCount = 0;
        var childIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as CHILDCOUNT from " + incidentTableName + " where (inc.INCIDENT_ASSOCIATION_TYPE = 1 and  inc.STATUS in (0,1,2,3))";
        childIncidentCountsql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        childIncidentCountsql += " and LOWER(inc.region) IN (" + data.context.cxt_region_full_name + " )";
        console.log("childIncidentCountsql =>" + childIncidentCountsql);
        var childIncidentCountResult = getOracleQueryResult(connection, childIncidentCountsql, sync);
        if (childIncidentCountResult != null) {
            childIncidentCount = childIncidentCountResult.rows[0].CHILDCOUNT;
        }
        doRelease(connection);
        return childIncidentCount;

    }

    /**
     * Description
     * @method getMasterIncidentCountForRegion_SqlHandler
     * @param {} data
     * @param {} sync
     * @param {} connection
     * @return masterIncidentCount
     */
    this.getMasterIncidentCountForRegion_SqlHandler = function (data, sync, connection) {
        var masterIncidentCount = 0;
        var masterIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as CHILDCOUNT from " + incidentTableName + " where (inc.INCIDENT_ASSOCIATION_TYPE = 1 and  inc.STATUS in (0,1,2,3))";
        masterIncidentCountsql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        masterIncidentCountsql += " and LOWER(inc.region) IN (" + data.context.cxt_region_full_name + " )";
        console.log("masterIncidentCountsql =>" + masterIncidentCountsql);
        var masterIncidentCountResult = getOracleQueryResult(connection, masterIncidentCountsql, sync);
        if (masterIncidentCountResult != null) {
            masterIncidentCount = masterIncidentCountResult.rows[0].MASTERCOUNT;
        }
        doRelease(connection);
        return masterIncidentCount;

    }
    /**
     * Description
     * @method getChildIncidentCountForTechType_SqlHandler
     * @param {} data
     * @param {} sync
     * @param {} connection
     * @return childIncidentCount
     */

    this.getChildIncidentCountForTechType_SqlHandler = function (response, sync, connection) {
        var childIncidentCount = 0;
        var cause_tier_1 = response.context.cxt_tx_name;
        var childIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as CHILDCOUNT from " + incidentTableName + " where (inc.INCIDENT_ASSOCIATION_TYPE = 1 and  inc.STATUS in (0,1,2,3)) ";
		childIncidentCountsql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
        childIncidentCountsql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) = '" + cause_tier_1.toLowerCase() + "'";
        if (response.context.cxt_tech_type_region_full_name != null) {
			childIncidentCountsql += " and LOWER(inc.REGION) IN (" + response.context.cxt_tech_type_region_full_name + ")";
		}
        console.log("getChildIncidentCountForTechType_SqlHandler =>" + childIncidentCountsql);
        var childIncidentCountResult = getOracleQueryResult(connection, childIncidentCountsql, sync);
        if (childIncidentCountResult != null) {
            childIncidentCount = childIncidentCountResult.rows[0].CHILDCOUNT;
        }
        doRelease(connection);
        return childIncidentCount;

    }

    /**
     * Description
     * @method getMasterIncidentCountForTechType_SqlHandler
     * @param {} data
     * @param {} sync
     * @param {} connection
     * @return masterIncidentCount
     */

    this.getMasterIncidentCountForTechType_SqlHandler = function (response, sync, connection) {
        var masterIncidentCount = 0;
        var cause_tier_1 = response.context.cxt_tx_name;
        var masterIncidentCountsql = "Select count(distinct inc.INCIDENT_NUMBER) as MASTERCOUNT from " + incidentTableName + " inner join " + incidentTableName_2 + "  on (inc_2.ORIGINAL_INCIDENT_NUMBER = inc.INCIDENT_NUMBER) where (inc.INCIDENT_ASSOCIATION_TYPE  = 0 and inc.STATUS in (0,1,2,3))";
		masterIncidentCountsql += " and inc.SPE_FLD_ALARMEVENTSTARTTIME > to_char((SELECT ( SYSDATE - DATE '1970-01-01' ) * 86400 AS unixepoch FROM   DUAL) - 604800)";
		masterIncidentCountsql += " and LOWER(inc.CLOSURE_PRODUCT_CATEGORY_TIER1) = '" + cause_tier_1.toLowerCase() + "' ";
        console.log("getMasterIncidentCountForTechType_SqlHandler =>" + masterIncidentCountsql);
        var masterIncidentCountResult = getOracleQueryResult(connection, masterIncidentCountsql, sync);
        if (masterIncidentCountResult != null) {
            masterIncidentCount = masterIncidentCountResult.rows[0].MASTERCOUNT;
        }
        doRelease(connection);
        return masterIncidentCount;

    }



};