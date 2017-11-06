
module.exports = function() { 
    var syncSql = require('sync-sql');
    this.executeQuerySync = function(sql) {
        
            var output = syncSql.mysql(
                {
                    host: process.env.DB_HOST,
                    user: process.env.DB_USER,
                    password: process.env.DB_PWD,
                    database: process.env.DB_NAME,
                    port: '3306'
                },
                sql
            );
        
            return output;
        }

    
};
