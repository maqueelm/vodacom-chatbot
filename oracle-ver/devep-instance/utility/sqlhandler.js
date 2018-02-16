module.exports = function () {
   
    require('../db/db-mysql.js')();
    this.userLogin = function (response) {

        var loginQuery = "Select first_name,last_name from bot_users where email = '" + response.context.cxt_user_email + "' and password = '" + response.context.cxt_user_password + "';";
        var loginOutPut = executeQuerySync(loginQuery);
        return loginOutPut;
    }

    this.getIncidentData = function () {


        
    }



};