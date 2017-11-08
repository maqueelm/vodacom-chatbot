module.exports = function() { 
    var oracledb = require('oracledb');
    var dbConfig = require('./dbconfig.js');
    var oracleConnectionString = {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
    };

    var remedyString = {
        user: dbConfig.remedyUser,
        password: dbConfig.remedyPassword,
        connectString: dbConfig.remedyConnectionString 
    }
    this.getOracleDBConnection = function (sync) {
        try {
            var connection = sync.await(oracledb.getConnection(oracleConnectionString, sync.defer()));
        } catch (err) {
            //TODO Handle error
            console.log("error=>" + JSON.stringify(err.message));
        }
        return connection;
    }

    this.getOracleDBConnectionRemedy = function (sync) {
        try {
            var connection = sync.await(oracledb.getConnection(remedyString, sync.defer()));
        } catch (err) {
            //TODO Handle error
            console.log("error=>" + JSON.stringify(err.message));
        }
        return connection;
    }
    
    this.getOracleQueryResult = function (connection, sql,sync) {
        try {
            var result = sync.await(connection.execute(sql, [], { outFormat: oracledb.OBJECT }, sync.defer()));
            //this.doRelease(connection);
        }
        catch (err) {
            //TODO Handle error
            this.doRelease(connection);
            console.log("error=>" + JSON.stringify(err.message));
        }
        return result;
    }
       
    this.doRelease = function (connection) {
        connection.close(
            function (err) {
                if (err) { console.error(err.message); }
            });
    }

    
};
