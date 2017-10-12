module.exports = function() { 
    var oracledb = require('oracledb');
    this.getOracleDBConnection = function (oracleConnectionString,sync) {
        try {
            var connection = sync.await(oracledb.getConnection(oracleConnectionString, sync.defer()));
        } catch (err) {
            //TODO Handle error
            console.log("error=>" + JSON.stringify(err.message));
        }
        return connection;
    }
    
    this.getOracleQueryResult = function (connection, sql,sync) {
        try {
            var result = sync.await(connection.execute(sql, [], { outFormat: oracledb.OBJECT }, sync.defer()));
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
