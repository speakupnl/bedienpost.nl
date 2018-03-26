/**
 * RemoteStorage-new.js
 * v0.0.2
 *
 * Tiny Remote key-value storage library, using the new Compass remote storage back-end.
 */

(function() {

    /*
     * Attach library under 'remoteStorage' global.
     * Can be accessed as 'lib' within the library
     */
    var root = this;
    var lib = root.remoteStorage = {};
    exports.remoteStorage = lib;

    var serviceDomain = "https://storage.services.iperity.com/";
    var appname = "bedienpost";

    /*
     * Store an object under a key in the back-end.
     *
     * @arg key     The key of the data to store.
     * @arg value   The value to store; Either a string containing valid json (asText: true) or an object (asText: false)
     * @arg type    one of 'user', 'company' or 'companyAdmin'.
     * @arg astext  true: Expect string containing json as 'value' parameters. false: Expect object.
     */
    lib.setItem = function (key, value, type, asText) {
        var result = jQuery.Deferred();
        var url = getUrl(key, type);

        if (!asText) {
            value = JSON.stringify(value);
        }

        $.ajax
        ({
            type: "PUT",
            url: url,
            headers: {
                "Authorization": getAuthHeader()
            },
            contentType: 'json',
            data: value,
            success: function (response){
                result.resolve();
            },
            error: function (response) {
                result.reject();
                console.log("Error remoteStorage setItem with url: " + url);
                console.log(JSON.stringify(response));
            }
        });

        return result;
    }

    /*
     * Retrieve an object under a key in the back-end.
     *
     * @arg key     The key of the data to store.
     * @arg type - one of 'user', 'company' or 'companyAdmin'.
     * @arg astext  true: result is string containing json. false: result is object.
     */
    lib.getItem = function(key, type, asText) {
        var result = jQuery.Deferred();
        var url = getUrl(key, type);

        $.ajax
        ({
            type: "GET",
            url: url,
            headers: {
                "Authorization": getAuthHeader()
            },
            dataType: 'json',
            success: function (response){
                //console.log("getItem result: "+ JSON.stringify(response));
                if (asText) {
                    result.resolve(JSON.stringify(response));
                } else {
                    result.resolve(response);
                }
            },
            error: function (response) {
                console.log("Error remoteStorage getItem for url: " + url);
                console.log(JSON.stringify(response));
                result.reject(response);
            }
        });

        return result;
    }

    /* Helper functions */

    function getUrl(key, type) {
        return serviceDomain + appname + "/" + LOGINDATA.rest_server + "/" + type + "/" + key;
    }

    function getAuthHeader() {
        return "Basic " + btoa(LOGINDATA.rest_user + ":" + PASS);
    }

}).call(this);