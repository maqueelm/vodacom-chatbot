var workspaceId = "8124c390-c801-4bcf-8439-f6875d09ab23";
var Conversation = require("watson-developer-cloud/conversation/v1");
var conversation = new Conversation({
    username: "8ed4fefa-9d78-4374-92ca-e75319d53244",
    password: "ejsumaR2Noi6",
    version_date: '2017-05-26'
});
var row = 0;

function createEntityValue(val,entityName) {
    var params = {
        workspace_id: workspaceId,
        entity: entityName,
        value: val
      };

    conversation.createValue(params, function(err, response) {
        if (err) {
          console.error(err);
        } else {
          console.log(JSON.stringify(response, null, 2));
          var res = val.split(" ");
          for(i=0; i<res.length; i++) {
            createSynonymsForValue(val,entityName,res[i]);
          }
        }
      
      });


}

function createSynonymsForValue(val,entityName,synonymVal) { 
  var params = {
    workspace_id: workspaceId,
    entity: entityName,
    value: val,
    synonym: synonymVal
  };
 conversation.createSynonym(params, function(err, response) {   
    if (err) {
      console.error(err);
    } else {
      console.log(JSON.stringify(response, null, 2));
    }
  
  });
}   
