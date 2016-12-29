/*
  June, 2015 - jason.camacho@gfrmedia.com
  Allows user segmentation using CX and integration with Gigya.
*/

var cX = cX || {};
cX.callQueue = cX.callQueue || [];
var CXSenseApp = CXSenseApp || {};

(function () {

    var persistedQueryId = 'f9c6695b125857a710be6b79105e28fb04c786b8';
    var siteID = '1130534943865611190';

    CXSenseApp.SetCXSenseExternalId = function (usr) {
        var cx_userInfo = usr;

        if (typeof cx_userInfo !== "undefined" && typeof cx_userInfo.UID !== "undefined") {
            CXSenseApp.AsyncLoadHashingLib(function () {
                var gUID = cx_userInfo.UID;
                gUID = CryptoJS.SHA1(gUID).toString();
                if (typeof gUID !== "undefined") {
                    if (typeof sessionStorage !== "undefined") {
                        //Since this is call async, by setting the gUID in the sessionstorage
                        //we make sure the gUID is sent to CX the next time RegisterPageViewEvents is called when any page is loaded
                        sessionStorage.setItem("cXExternalId", gUID);
                    }
                }
            });
        }
    };

    CXSenseApp.RemoveCXSenseExternalId = function () {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("cXExternalId");
        }
    };

    CXSenseApp.GetUserProfileSegments = function (callback) {

        var cx_end_segments;

        cX.callQueue.push(['invoke', function () {
            var cx_end_segments = cX.getUserSegmentIds({ persistedQueryId: persistedQueryId });
            if (typeof callback !== "undefined" && typeof cx_end_segments !== "undefined") {
                callback(cx_end_segments);
            }
        }]);
    };

    //Let's queue up all events in one single call, as required by CX Sense Lib
    CXSenseApp.RegisterPageViewEvents = function () {
        CXSenseApp.AsyncLoadAdBlockDetect(function () {
            try {
                if (typeof sessionStorage !== "undefined") {
                    //If the user has already logged in,
                    //we can fetch the gUID if it has been already set
                    var gUID = sessionStorage.getItem("cXExternalId");
                }
                if (typeof gUID !== "undefined" && gUID !== null && gUID !== '') {
                    cX.callQueue.push(['addExternalId', { 'id': gUID, 'type': 'gfr' }]);
                    cX.callQueue.push(['setCustomParameters', { loggedIn: 'Yes' }]);
                } else {
                    cX.callQueue.push(['setCustomParameters', { loggedIn: 'No' }]);
                }
                // Check for AdBlock
                //cX.callQueue.push(['setCustomParameters', { adBlockEnabled: ((typeof (OAS_RICH) === "undefined") ? "Yes" : "No") }]);
                cX.callQueue.push(["setCustomParameters", {
                    adBlockEnabled: ((typeof (detectAdBlock) === "undefined") ? "Yes" : "No")
                }]);
                //Log DNT
                cX.callQueue.push(['setCustomParameters', { doNotTrack: (typeof (navigator) !== "undefined" && navigator.doNotTrack === "1") ? "Yes" : "No" }]);

                var isInterstitial = (window.location.href.indexOf("interstitial") > -1);
                if (!isInterstitial) {
                    cX.callQueue.push(['setSiteId', siteID]);

                    if (typeof sessionStorage !== 'undefined') {

                        if ((typeof sessionStorage.realReferrer === "undefined" || sessionStorage.realReferrer === "" || sessionStorage.realReferrer === null)
                            && (document.referrer.indexOf("interstitial") > -1)) {
                            cX.callQueue.push(['sendPageViewEvent', { referrer: '   ' }]);
                        }
                        else {
                            cX.callQueue.push(['sendPageViewEvent', { referrer: (sessionStorage.realReferrer || document.referrer) }]);
                        }
                        sessionStorage.removeItem('realReferrer');
                    }
                    else {
                        cX.callQueue.push(['sendPageViewEvent']);
                    }
                }
                CXSenseApp.AsyncLoadCXSense();
            }
            catch (ex) {
                console.log("An error ocurred registering page view events in CX Tag Tools: " + ex.message);
            }
        });
    };

    CXSenseApp.AsyncLoadAdBlockDetect = function (callback) {
        var uri = '/assets/js/adscript.js';
        jQuery.ajax({
            url: uri,
            dataType: "script",
            cache: true,
            async: true
        }).done(callback).fail(function (jqXHR, textStatus, errorThrown) {
            console.log(textStatus);
            callback();
        })
    };

    CXSenseApp.AsyncLoadCXSense = function () {
        var uri = 'http' + ('https:' === location.protocol ? 's://s' : '://') + 'cdn.cxense.com/cx.js';
        jQuery.ajax({
            url: uri,
            dataType: 'script',
            cache: true,
            async: true
        });
    };

    CXSenseApp.AsyncLoadHashingLib = function (callback) {
        var uri = '/assets/js/sha1.js';
        jQuery.ajax({
            url: uri,
            dataType: 'script',
            cache: true,
            async: true
        }).done(callback)
          .fail(function (jqXHR, textStatus, errorThrown) {
              console.log("Hashing lib script could not be async loaded!");
              console.log(textStatus);
          });
    }
})();

//get cx user segments
CXSenseApp.GetUserProfileSegments(function (cx_end_segments) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("cx_usr_segments", cx_end_segments);
    }
});

//TODO: Possible rewrite this to use document.createElement('script') and load the script async.
//Instead of async loading jquery to fetch a JS LOOOL :)
if (typeof jQuery !== 'undefined') {
    // jQuery JS file was already loaded
    CXSenseApp.RegisterPageViewEvents();
} else {
    function getScript(url, success) {
        var script = document.createElement('script');
        script.src = url;
        var head = document.getElementsByTagName('head')[0],
        done = false;
        script.onload = script.onreadystatechange = function () {
            if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
                done = true;
                success();
                script.onload = script.onreadystatechange = null;
                head.removeChild(script);
            };
        };
        head.appendChild(script);
    };
    getScript('//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js', function () {
        // jQuery loaded
        $j = jQuery.noConflict();
        CXSenseApp.RegisterPageViewEvents();
    });
};
