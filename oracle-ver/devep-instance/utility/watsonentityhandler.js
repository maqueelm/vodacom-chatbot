module.exports = function () {
    var workspaceId = process.env.WORKSPACE_ID;
    var Conversation = require("watson-developer-cloud/conversation/v1");
    var conversation = new Conversation({
        username: process.env.CONVERSATION_USERNAME,
        password: process.env.CONVERSATION_PASSWORD,
        version_date: '2017-05-26'
    });
    var S = require('string');
    /**
     * Description
     * @method createEntityValue
     * @param {} val
     * @param {} entityName
     * @return 
     */
    this.createEntityValue = function (val, entityName) {
        val = S(val).replaceAll('corporate', '').s;
        val = S(val).replaceAll('customer', '').s;

        if (val != '' && val.toLowerCase() != 'region' && val.toLowerCase() != 'corporate' && val.toLowerCase() != 'customer' && val.toLowerCase() != 'yes' && val.toLowerCase() != 'no') {
            var params = {
                workspace_id: workspaceId,
                entity: entityName,
                value: val
            };



            conversation.createValue(params, function (err, resp) {
                if (err) {
                    console.error(err);
                } else {
                    console.log(JSON.stringify(resp, null, 2));
                    /* var res = val.split(" ");
                     for (i = 0; i < res.length; i++) {
                         if (res[i].length > 1 && entityName != '2g-sites') {
                             //createSynonymsForValue(val, entityName, res[i]); will not create synonyms for any entity.
                         }
                     }*/
                }

            });

        }


    }

    /**
     * Description
     * @method createSynonymsForValue
     * @param {} val
     * @param {} entityName
     * @param {} synonymVal
     * @return 
     */
    this.createSynonymsForValue = function (val, entityName, synonymVal) {
        var params = {
            workspace_id: workspaceId,
            entity: entityName,
            value: val,
            synonym: synonymVal
        };
        conversation.createSynonym(params, function (err, resp) {
            if (err) {
                console.error(err);
            } else {
                console.log(JSON.stringify(resp, null, 2));
            }

        });
    }

    /**
     * Description
     * @method getWatsonResponse
     * @param {} data
     * @param {} sync
     * @return response
     */
    this.getWatsonResponse = function (data, sync, inputText) {
        var inputJSON = {};
        if (inputText != null) {
            inputJSON = { "text": inputText };
        }
        var payload = {
            workspace_id: process.env.WORKSPACE_ID,
            context: data.context || {},
            input: inputJSON
        };
        // Get a response to a user's input. conversation.message method takes user input in payload and returns watson response on that input in data object.
        var response = null;
        try {
            response = sync.await(conversation.message(payload, sync.defer()));

        } catch (err) {
            //TODO Handle error
            console.log("error=>" + JSON.stringify(err.message));
        }
        return response;


    }
    // Send the input to the conversation service
    /**
     * Description
     * @method getWatsonResponse
     * @param {} payload
     * @return response
     */
    this.getResponse = function (payload, sync) {

        // Get a response to a user's input. conversation.message method takes user input in payload and returns watson response on that input in data object.
        var response = null;
        try {
            response = sync.await(conversation.message(payload, sync.defer()));

        } catch (err) {
            //TODO Handle error
            console.log("error=>" + JSON.stringify(err.message));
        }
        return response;


    }

    /**
 * Description
 * @method sendMessageToWatson
 * @param {} app
 * @param {} request
 * @param {} sync
 * @return res
 */
    this.sendMessageToWatson = function (app, request, sync) {

        var res = sync.await(app.post('/api/message', request, sync.defer()));
        return res;
    }




};
