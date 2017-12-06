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

};