// Overall viewmodel for this screen, along with initial state
var global = {};
global.autoPauseItem = null;

var shortcutsActive = false;
var keypadActive = false;
var dialing = false;
var transfering = false;
var selectingNumber = false;
var contactPhoneNumberPriority = ["work", "mobile", "home"];



/*
 * Extend knockout.observable to have 'lightweight' events that don't trigger server updates.
 * Based on: http://stackoverflow.com/a/33438956/331637
 *
 * Use as following (assuming 'this.name' is an observable):
 * this.name.subscribeIgnoreServerUpdate(function(newValue) { } ));
 * this.name.poke("Ted");
 */

ko.observable.fn.subscribeIgnoreServerUpdate = function (callback, thisValue, event){
    var self = this;
    this.subscribe(function(newValue) {
        if (!self.paused)
            callback(newValue);
    }, thisValue, event);
    return this;
};
ko.observable.fn.serverUpdate = function (newValue) {
    this.paused = true;
    var result = this(newValue);
    this.paused = undefined;
    return result;
};

/* ------------------------------------------------------------------------------------------ */

function UserListItem(id, name, ext, log, avail, ringing, company) {
    _.bindAll(this, 'startCall', 'noCalls', 'setFavorite');
    var self = this;

    this.id = ko.observable(id                            || 0);
    this.name = ko.observable(name                        || "");
    this.ext = ko.observable(ext                          || "");
    this.log = ko.observable(log                          || false);
    this.avail = ko.observable(avail                      || false);
    this.ringing = ko.observable(ringing                  || false);
    this.company = ko.observable(company                  || "");

    this.directionIsOut = ko.observable(true);
    
    this.connectedName = ko.observable("");
    this.connectedNr = ko.observable("");
    this.callStartTime = ko.observable(0);
    this.amImportedContact = ko.observable(false);
    this.numbers = ko.observableArray();
    this.note = ko.observable("");

    var storedAsFav = isFav(id, UserListItem.storageKey());
    this.favorite = storedAsFav;

    this.numberAndDuration = ko.computed(function() 
    {
        if (this.callStartTime() == 0) {
            return "";
        }

        var callStart = moment.utc(this.callStartTime() * 1000.);
        var duration = (currentTime() - callStart); // duration in milliseconds
        duration = (duration >= 0) ? duration : 0; // no negative values.

        var timeString = moment.utc(duration).format("H:mm:ss"); // Create a date object and format it.
        var timePart = "[" + timeString + "]";

        var numberPart = this.connectedNr();

        if (listingViewModel.obfuscateWholeNumber()) {
            numberPart = "..........";
        } else if (listingViewModel.obfuscateNumber()) {
            if ((numberPart != "") && this.connectedName() != "") {
                var npend = numberPart.substr(-5);
                numberPart = numberPart.replace(npend, ".....");
            }
        }
        numberPart = (numberPart != "") ? numberPart + " " : "";

        return numberPart + timePart;
        
    }, this);

    this.secondRow = ko.computed(function() {

       return this.ext() + (((this.ext() != "") && (this.note() != "")) ? " - " : "") + this.note();
    }, this);

    this.noteUpdated = function() {
        console.log("note Updated");
        storeUserNote(self.id(), self.note());
    };

}

UserListItem.prototype.startCall = function(number, name, startTime, directionIsOut) {
    this.connectedName(name);
    this.connectedNr(number);
    this.callStartTime(startTime);
    this.directionIsOut(directionIsOut);
}

UserListItem.prototype.noCalls = function() {
    this.connectedName("");
    this.connectedNr("");
    this.callStartTime(0);
}

UserListItem.prototype.setFavorite = function (fav) {
    this.favorite(fav);
}

UserListItem.storageKey = function() {
    return "UserListFavs";
}

UserListItem.saveFavs = function(userList) {
    saveFavs(userList, UserListItem.storageKey());  
}

UserListItem.prototype.noteChanged = function (val) {

}

UserListItem.prototype.noteClicked = function () {

}

function isFav(id, storageKey) {
    var isFavObservable = ko.observable(false);
    if (global[storageKey] == null) {
        // We haven't retrieved this storage-key from remote yet, let's do so now.
        global[storageKey] = {};
        global[storageKey].deferred = remoteStorage.getItem(storageKey, "user", true);
        global[storageKey].favs = {};
    }

    // Use a deferred to set isFavObservable
    global[storageKey].deferred.done(function(storageKey, isFavObservable) {
        return function(response) {
            // Received response
            var responseArr = (response) ? JSON.parse(response) : {};
            global[storageKey].favs = _.union(global[storageKey].favs, responseArr); // Merge local and remote results.
            isFavObservable(_.contains(global[storageKey].favs, id));
        }
    }(storageKey, isFavObservable));

    return isFavObservable;
}

function saveFavs(list, storageKey) {
    var favIndices = [];

    for (index in list) {
        var item = list[index];
        if (item.favorite()) {
            favIndices.push(item.id());
        }
    }
    var json = JSON.stringify(favIndices);
    console.log("Saving favorite ids: " + JSON.stringify(favIndices) + " for key " + storageKey);
    global[storageKey].favs = favIndices;
    remoteStorage.setItem(storageKey, json, "user", true);
}

/* Helper debounced functions for QueueListItem */
var pauseTimeUpdatedDebounced = _.debounce(pauseTimeUpdated, 5000);
var warnIfNoAgentsUpdatedDebounced = _.debounce(function(){queuesSettingUpdated("warnIfNoAgents")}, 5000);
var openUrlAfterCallEndDebounced = _.debounce(function(){queuesSettingUpdated("openUrlAfterCallEnd")}, 5000);

function QueueListItem(id, name) {
    _.bindAll(this, 'queueLogin', 'togglePause');

    this.id = ko.observable(id                            || "");
    this.name = ko.observable(name                        || "");

    this.signInOut = ko.observable(false);
    this.membersStrTranslation = ko.observableArray();
    this.membersStrValues = ko.observableArray();
    this.waitingAmount = ko.observable(0);
    this.maxWaitingStartTime = ko.observable(0);
    this.pauseTime = ko.observable(0);
    this.paused = ko.observable(false);
    this.orderNr = 0;
    this.warnIfNoAgents = ko.observable(false);
    this.openUrlAfterCallEnd = ko.observable(false);
    this.agentsInQueueCount = ko.observable(0);

    this.favorite = isFav(id, QueueListItem.storageKey());

    this.pauseTime.subscribeIgnoreServerUpdate(pauseTimeUpdatedDebounced);
    this.warnIfNoAgents.subscribeIgnoreServerUpdate(warnIfNoAgentsUpdatedDebounced);
    this.openUrlAfterCallEnd.subscribeIgnoreServerUpdate(openUrlAfterCallEndDebounced);

    this.maxWaitingTime = ko.computed(function()
    {
        var duration = 0;
        if (this.waitingAmount() != 0) {
            var waitingStart = moment.utc(this.maxWaitingStartTime());
            duration = (currentTime() - waitingStart); // duration in milliseconds
            duration = (duration >= 0) ? duration : 0; // no negative values.
        }


        var timeString = moment.utc(duration).format("H:mm:ss"); // Create a date object and format it.
        return timeString;

    }, this);

    this.warnForEmptyQueue = ko.computed(function() {
        console.log("Evaluating warnForEmptyQueue");
        var queue = Lisa.Connection.model.queues[this.id()];

        if ((this.warnIfNoAgents()) && (this.agentsInQueueCount() == 0)) {
            listingViewModel.emptyQueue(queue);
            //$('#queue-lowwatermark-alert-1').show();
            listingViewModel.showAlert(true);
            return true;
        } else {
            // Hide the queue warning if logging into the queue with warning active
            if (listingViewModel.emptyQueue() == queue) {
                console.log("No more warning for queue" + queue);
                listingViewModel.showAlert(false);
                //listingViewModel.emptyQueue(null);
            }
        }

        return false;
    }, this);
}

function loginQueueFollowingGlobalPause(queue) {
    conn.queueLogin(queue);

    // If 'globalPause' if activated, also pause the new queue. However, give the queue some time to logon.
    _.delay(function(){
        if (listingViewModel.pausedGlobally()) {
            conn.queuePause(queue);
        }
    }, 100);
}

QueueListItem.prototype.queueLogin = function (amLoggingIn) {
    console.origLog(this);
    //this.signInOut(amLoggingIn); // Event should come correctly through api.
    var queue = Lisa.Connection.model.queues[this.id()];
    if (amLoggingIn) {
        loginQueueFollowingGlobalPause(queue);
    } else {
        conn.queueLogout(queue);
    }
}

QueueListItem.prototype.togglePause = function () {
    console.log("togglePause clicked for item: " + this.name())

    //this.signInOut(amLoggingIn); // Event should come correctly through api.
    if (!this.signInOut) {
        console.log("Can't pause queue, since we're not logged into queue.");
        return;
    }

    var queue = Lisa.Connection.model.queues[this.id()];
    var curPaused = queue.paused;

    if (curPaused) {
            // unpause the queue that was clicked.
            //removeAutopauseItemFromGui(queue); // unpausing a queue shouldn't stop afhandeltijd.
            conn.queueUnpause(queue);
    } else {
        if (!listingViewModel.allowPause()) {
            console.log("Users disallowed from pausing in this company. Not pausing.");
        } else {
            conn.queuePause(queue);
        }
    }
}

function handleAutopauseStoppedEvent() {
    console.log("Handling auto-pause stopped event for GUI.");
    incomingCallEntries.remove(global.autoPauseItem);
    global.autoPauseItem = null;
}


function removeAutopauseItemFromGui() {
    // If we were in auto-pause, remove auto-pause indication on unpause.
    if (global.autoPauseItem) {
        console.log("Removing auto-pause item");

        queuePause.stopUnpauseTimer();
    }
}

QueueListItem.saveFavs = function(queueList) {
    saveFavs(queueList, QueueListItem.storageKey());  
}

QueueListItem.storageKey = function() {
    return "QueueListFavs";
}

// Set the new pause-times for the queues after one of the values has been changed.
function pauseTimeUpdated() {
    var queuePauseSettings = {};
    for (var queueKey in listingViewModel.filterWaitingQueue()) {
        var queue = listingViewModel.filterWaitingQueue()[queueKey];

        var pauseTime = parseInt(queue.pauseTime());
        if (pauseTime < 0 ) {
            pauseTime = 0;
        }

        /*queueSettings = {
            pauseTime: pauseTime,
            warnIfNoAgents: queue.warnIfNoAgents()
        };*/

        queuePauseSettings[queue.id()] = pauseTime;
    }
    //console.log(queuePauseSettings);
    setAutoPauseSettingsInBackend(queuePauseSettings);
}

function setAutoPauseSettingsInGui(queuePauseSettings) {
    console.log("Retrieved auto-pause settings from server, updating settings gui-model.")
    console.log(JSON.stringify(queuePauseSettings));
    for (var queueKey in listingViewModel.filterWaitingQueue()) {
        var queueItem = listingViewModel.filterWaitingQueue()[queueKey];
        var pauseTime = queuePauseSettings[queueItem.id()];
        if (pauseTime) {
            queueItem.pauseTime.serverUpdate(pauseTime);
        }
    }
}

/*
 * Queues setting has been updated in the GUI. Process and upload new settings to server.
 */
function queuesSettingUpdated(settingsName) {
    var queues = {};
    for (var queueKey in listingViewModel.filterWaitingQueue()) {
        var queueItem = listingViewModel.filterWaitingQueue()[queueKey];
        queues[queueItem.id()] = queueItem[settingsName]();
    }

    console.log("queue-setting " + settingsName + ": " + JSON.stringify(queues));
    companySettings[settingsName] = queues;
    requestStoreCompanySettings();
}

/*
 * Queues setting has been retrieved from server. Process and change values in the GUI.
 */
function setQueuesSettingInGui(settingsName) {
    console.log("Retrieved " + settingsName + " settings from server, updating settings gui-model.");
    for (var queueKey in listingViewModel.filterWaitingQueue()) {
        var queueItem = listingViewModel.filterWaitingQueue()[queueKey];
        if (companySettings[settingsName]) {
            var setting = companySettings[settingsName][queueItem.id()];
            if (setting !== undefined) {
                queueItem[settingsName].serverUpdate(setting);
            }
        }
    }
}

function CallListItem(id, name, startTime, directionIsOut, descriptionWithNumber, callObj, number) {
    _.bindAll(this, 'stopCall');
    var self = this;

    this.id = ko.observable(id                            || "");
    this.name = ko.observable(name                        || "");
    this.callStartTime = ko.observable(startTime          || 0);
    this.directionIsOut = ko.observable(directionIsOut    || false);
    this.finished = ko.observable(false);
    this.descriptionWithNumber = ko.observable(descriptionWithNumber || "");
    this.isAutoPause = ko.observable(false);
    this.autoPauseQueue = null;
    this.number = ko.observable(number);
    this.callObj = ko.observable(callObj);

    this.htmlid = ko.computed(function() {
        return (self.id) ? self.id().replace(/[^a-z0-9]/gi, '') : '';
    });

    this.callDuration = ko.computed(function() {
        if (this.callStartTime() == 0) {
            return 0;
        }

        if (this.finished()){
            return this.callDuration();
        }

        var callStart = moment.utc(this.callStartTime() * 1000.);
        var duration = (currentTime() - callStart); // duration in milliseconds

        if (this.isAutoPause()) {
            if (duration < 0) { duration = -duration };
        } else {
            duration = (duration >= 0) ? duration : 0; // no negative values.
        }

        return duration;
    }, this);

    this.timeConnected = ko.computed(function() {
        var timeString = moment.utc(this.callDuration()).format("H:mm:ss"); // Create a date object and format it.
        return timeString;

    }, this);

    this.visible = ko.computed(function() {
        if (model == null) {
            return false;
        }

        var callStart = moment.utc(this.callStartTime() * 1000.);
        var duration = this.callDuration(); // duration in milliseconds

        var longEnough = ((duration > 1500));
        var firstCall = (_.size(model.users[Lisa.Connection.myUserId].calls) == 1);
        var visible = ((firstCall) || (longEnough) || this.isAutoPause());
        return visible;
    }, this);

    /* We use the destroy-property to hide calls that have lasted less than 2 seconds */
    // Hacky solution for hunkemoller
    this._destroy = ko.computed(function() {
        var visible = this.visible();
        if (!visible) console.log("Suppressing view for call " + this.id());

        return !visible;
    }, this);

    this.toDisplay = ko.computed(function()
    {
        var result = this.name();
        var call = this.thisCallOrOriginalCall(this.id());

        if (call && call.userHasChanged) result = "[" + i18next.t("fallback") + "] " + result; //FIXME: Icon
        if (this.finished()) result +=  i18next.t(" - finished");

        return result;
    }, this);

    // Try to determine the last queue that this call was in. - BEWARE, this only works with the queuePause module active.
    function getQueueIdForCall(callObj) {
        var queueId = null;
        if (callObj && callObj.lastQueue) {
                queueId = callObj.lastQueue.id;
        }
        return queueId;
    }

    function getOtherPartyNumberForCall(callObj) {
        incomingNumber = "";

        if (typeof callObj.destinationObj === "string") {
            incomingNumber = callObj.destinationObj;
        }
        else if (callObj.destinationObj["extension"]) {
            incomingNumber = callObj.destinationObj.extension;
        }

        return incomingNumber;
    }

    this.crmClicked = function() {
        var url = listingViewModel.crmUrl();

        if (url) {
            var callid = this.id(),
                incomingNumber = this.number(),
                queueId = '',
                myUserId = Lisa.Connection.myUserId,
                username =  USERNAME,
                duration = '';

            if (this.finished()) {
                duration = Math.round(this.callDuration() / 1000);
            }

            var theCall = this.callObj();
            queueId = getQueueIdForCall(theCall);
            if (!incomingNumber) {
                incomingNumber = getOtherPartyNumberForCall(theCall);
            }
            
            url = url.replace(/\$callerid/gi, incomingNumber);
            url = url.replace(/\$callid/gi, callid);
            url = url.replace(/\$queueid/gi, queueId);
            url = url.replace(/\$userid/gi, myUserId);
            url = url.replace(/\$duration/gi, duration);
            url = url.replace(/\$username/gi, username);

            this.openUrlBasedOnSetting(
                url, 
                this.resolveSizeForOpenedWindow( companySettings && companySettings.openCardUrl || ""),
                i18next.t("Customer card")
            );
        }

    }

    this.openNotesOnEndCall = function() {
        var incomingNumber = this.number(),
            queueId = '';

        // Try to determine the last queue that this call was in. - BEWARE, this only works with the queuePause module active.
        var theCall = this.callObj();
        if (theCall) {
            console.log(theCall);
            if (theCall.state !== "ANSWERED") return;
            if (theCall.queueCallForCall) return; // This is the 'fake' call from the queue to an agent. Ignore.
            queueId = getQueueIdForCall(theCall);
        }
        if (!incomingNumber) {
            incomingNumber = getOtherPartyNumberForCall(theCall);
        }

        if (
                (
                   (companySettings["openUrlAfterCallEnd"] && companySettings["showCallNotePage"] == "Only after specific Queue-calls (choose below)" && companySettings["openUrlAfterCallEnd"][queueId] === true )
                || (companySettings["showCallNotePage"] == "After all calls")
                || (companySettings["showCallNotePage"] == "After all inbound calls" && !this.directionIsOut())
                )
           ) 
        {
            var url = listingViewModel.callNoteUrl();

            if (url) {
                var callid = this.id(),                    
                    myUserId = Lisa.Connection.myUserId,
                    duration = Math.round(this.callDuration() / 1000),
                    username = USERNAME;
                
                url = url.replace(/\$callerid/gi, incomingNumber);
                url = url.replace(/\$callid/gi, callid);
                url = url.replace(/\$queueid/gi, queueId);
                url = url.replace(/\$userid/gi, myUserId);
                url = url.replace(/\$duration/gi, duration);
                url = url.replace(/\$username/gi, username);

                this.openUrlBasedOnSetting(
                    url, 
                    this.resolveSizeForOpenedWindow( companySettings && companySettings.openNoteUrl || ""),
                    i18next.t("Call note")
                );
            }
        }
    }

    this.openUrlBasedOnSetting = function(url, size, title){
        console.log(url);

        if (size == 1) {
            window.open(url, "afterCallWnd", `height=${$(window).height()},width=${$(window).width()}}`);
        }
        else if (size == 2) {
            eModal.iframe({url: url, size: eModal.size.xl }, title);
        }
        else if (size == 3) {
            eModal.iframe({url: url, size: eModal.size.lg }, title);
        }
        else {
            window.open(url);
        }
    }

    this.resolveSizeForOpenedWindow = function(value) {
        if (value == "New window") {
            return 1;
        }
        else if (value == "Pop-up large (might not be supported by all applications)") {
            return 3;
        }
        else if (value == "Pop-up standard (might not be supported by all applications)") {
            return 2;
        }
        return 0;
    }
}

/*
 * Returns the queueCallForCall for a call with a certain id, or the call itself if the call has no queueCallForCall.
 * If no call with this id exists, null is returned.
 */
CallListItem.prototype.thisCallOrOriginalCall = function(id) {
    var theCall = this.callObj();
    var originalCall = null;
    if (theCall) {
        var qcId = theCall.queueCallForCall;
        originalCall = model.calls[qcId];
    }
    return originalCall || theCall;
}

window.addEventListener('message', function(event) {
    if (event.data == "closeModal") {
        console.log("Requested to close event through postMessage");
        $('.modal.in').modal('hide');
    }
});

CallListItem.prototype.stopCall = function() {

    function animateWidth(elem) {
        var width = 100;
        var id = setInterval(frame, 50);
        function frame() {
            if (width == 0 || !elem) {
                clearInterval(id);
            } else {
                width--; 
                elem.style.width = width + '%'; 
            }
        }
    }

    this.finished(true);

    // Potentially open modal at the end of the call.
    if (this.visible()) {
        this.openNotesOnEndCall();
    }

    // Don't show 'finished' for queue-calls.
    if ((this.originalCallModel.queueCallForCall != null) && (this.originalCallModel.queueCallForCall != "")) { // Is this a queue-call?
        incomingCallEntries.remove(this);
    } else {
        //initiate background progress bar

        animateWidth( document.getElementById( this.htmlid() ) );

        //delayed setting of callStartTime(0), so that row is removed
        _.delay(
            function (self) {
                return function () {
                    self.callStartTime(0);
                }
            }(this)
            , 4200);

        _.delay(
            function (self) {
                return function () {
                    if (self.finished()) {
                        incomingCallEntries.remove(self);
                    }

                }
            }(this)
            , 10000);
    }
}

/* This is slightly hacky; Pressing a auto-pause message in the format of a CallListItem.
 * If we get any more of these, refactor the list to be able to contain multiple types of items. */
CallListItem.prototype.makeAutoPause = function(pauseTime) {
    this.isAutoPause(true);
    this.finished(false);
    this.name(i18next.t("Roundup time"));
    this.callStartTime(currentTime().valueOf() / 1000 + pauseTime);

    if (global.autoPauseItem != null) {
        console.log("Other autopauseItem still active. This shouldn't happen. Overwriting.");
    }
    global.autoPauseItem = this;

    /*_.delay(
        function (self) {
            return function () {
                if (self.autoPauseQueue) {
                    self.autoPauseQueue.autoPauseItem = null;
                    self.autoPauseQueue = null;
                    incomingCallEntries.remove(self);
                }
            }
        }(this), pauseTime * 1000);*/
}

/*
 * ko.observable with the current time that triggers every second. 
 *  All time-dependent function can efficiently track this one observable. 
 *  Knockout.js wizardry should only trigger computables that really are dependent on this observable *right now*.
 */
currentTime = ko.observable(0);

setInterval(function() {
    var myDate = new Date();
    currentTime(moment.utc(moment.utc().valueOf() + Lisa.Connection.serverTimeOffset));
}, 500); // Update UserListItem.currentTime every second.

function nameComparator(left, right) {
    return left.name() == right.name() ? 0 : (left.name() < right.name() ? -1 : 1);    
}

/* 
 * Sorts as following: 
 * - Keep non-favorites alphabetical
 * - Keep favorites last-favorited-first
 */
function favComparator(left, right) {
    if (left.warnForEmptyQueue() != right.warnForEmptyQueue()) {
            return left.warnForEmptyQueue() && !right.warnForEmptyQueue() ? -1 : 1
    }
    return left.favorite() == right.favorite() ? nameComparator(left,right) : (left.favorite() && !right.favorite() ? -1 : 1);
}

var ListingsViewModel = function(){
    var self = this;
    
    self.currentList = ko.observable();
    self.favoriteList = ko.observable();
    self.waitingQueueList = ko.observable();
    self.incomingCallList = ko.observable();
    self.connectedPhone = ko.observable(false);
    
    self.clickedListItem = ko.observable();
    self.clickedListItemName = ko.observable();
    self.waitingQueueItemToSignInOut = ko.observable();
    self.waitingQueueItemToMarkFavorite = ko.observable();
    
    self.loginName = ko.observable();
    self.loggedInName = ko.observable();
    self.loginPass = ko.observable();
    self.incomingCallMailTo = ko.observable();
    self.search = ko.observable().extend({ rateLimit: { timeout: 500, method: "notifyWhenChangesStop" } });
    self.shortcutKey = ko.observable();
    self.callingState = ko.observable('onhook');
    self.authError = ko.observable(false);
    self.numericInput = ko.observable("");
    self.phoneIp = ko.observable("");

    self.obfuscateNumber = ko.observable(true);
    self.amAdmin = ko.observable(false);
    self.obfuscateWholeNumber = ko.observable(false);
    self.crmUrl = ko.observable("");
    self.afterCallUrl = ko.observable("");      //TODO - Remove
    self.customAuthHeader = ko.observable("");  //TODO - Remove
    self.callNoteUrl = ko.observable("");


    self.allowPause = ko.observable(true);
    self.logDownloadEnabled = ko.observable(false);

    self.pausedGlobally = ko.observable(false);
    self.emptyQueue = ko.observable(null);
    self.showAlert = ko.observable(false);
    self.showPauseAlert = ko.observable(false);
    self.receivedNumberFromExtension = ko.observable(null);
    self.receivedNumberFromExtension.subscribe(function(newValue) {
        if (newValue) {
            listingViewModel.showKeypadWithNumber(newValue);
        }
    });

    self.protectNumberOptions = ko.observableArray([ 
        { val: "Do not hide", text: "Do not hide" }, 
        { val: "Hide only last 5 digits", text: "Hide only last 5 digits" },
        { val: "Hide entire number", text: "Hide entire number" }
    ]);

    self.selectedProtectNumberOption = ko.observable("Hide only last 5 digits");

    self.helpUrl = ko.observable("");
    self.connectionStatus = ko.observable(true);

    self.language = ko.observable(null);
    self.language.subscribe(function(newValue) {
        switchLanguage(newValue);

        self.setTipInSettings();
    });
    
    self.openUrlOptions = ko.observableArray([ 
        { val: "New window", text: "New window" }, 
        { val: "New tab (recommended)", text: "New tab (recommended)" },
        { val: "Pop-up large (might not be supported by all applications)", text: "Pop-up large (might not be supported by all applications)" },
        { val: "Pop-up standard (might not be supported by all applications)", text: "Pop-up standard (might not be supported by all applications)" }
    ]);
    self.selectedOpenCardUrlOption = ko.observable("New tab (recommended)");
    self.selectedOpenNoteUrlOption = ko.observable("New tab (recommended)");

    //`Queue Settings`
    self.showCallNotePageOptions = ko.observableArray([ 
        { val: "After all calls", text: "After all calls" }, 
        { val: "After all inbound calls", text: "After all inbound calls" },
        { val: "Only after specific Queue-calls (choose below)", text: "Only after specific Queue-calls (choose below)" }
    ]);
    self.selectedShowCallNotePageOption = ko.observable("Only after specific Queue-calls (choose below)");
    self.selectedShowCallNotePageOption.subscribe(function(newValue) {
        if (self.selectedShowCallNotePageOption() === 'Only after specific Queue-calls (choose below)') {
            $('#showCallNoteQueueHolder').hide().slideDown();
        }
        else{
            $('#showCallNoteQueueHolder').slideUp();
        }
    });

    self.phoneAuthAvailable = ko.computed(function(){
        return ((self.phoneIp() != ""));
    }, self);

    self.currentList.subscribe(function()
    {
        self.search(""); 
    });

    self.selectedProtectNumberOption.subscribeIgnoreServerUpdate(function()
    {
        obfuscateNumberFromSelectedProtectNumberOption();
        console.log("obfuscateNumber: " + companySettings.obfuscateNumber + ", obfuscateWholeNumber: " + companySettings.obfuscateWholeNumber);
        requestStoreCompanySettings();
    });

    self.selectedOpenCardUrlOption.subscribeIgnoreServerUpdate(function(value)
    {
        companySettings.openCardUrl = value;
        requestStoreCompanySettings();
    });
    self.selectedOpenNoteUrlOption.subscribeIgnoreServerUpdate(function(value)
    {
        companySettings.openNoteUrl = value;
        requestStoreCompanySettings();
    });
    self.selectedShowCallNotePageOption.subscribeIgnoreServerUpdate(function(value)
    {
        companySettings.showCallNotePage = value;
        requestStoreCompanySettings();
    });

 
     function filterListByName(list, searchParam) {
       if (!list) {
         return null;
       }

       if (!searchParam) {
         return list;
       }

       console.log("Searching...");

       searchParam = searchParam.toLowerCase();  
       var filteredEntries = [];

       for (entryKey in list) {
           var entry = list[entryKey];
           var company = entry.company();
           var entrySearchString = entry.name().toLowerCase() + (company ? " " + company.toLowerCase() : "");
           if (entrySearchString.indexOf(searchParam) > -1) {
               filteredEntries.push(entry);
           }
       }
 
       return filteredEntries;
     }


    self.filteredItems = ko.computed(function()
    {
        if (self.currentList()){
            var searchParam = self.search();
            var result = filterListByName(self.currentList().entries(), searchParam);
            return result;
        }
        return [];
        
    }, self);
    
    self.favFilteredItems = ko.computed(function() 
    {
        if (self.currentList()){
            var result = _.filter(self.currentList().entries(), function(item){
                return item.favorite();
            });
            return result;
        }
        return [];
    }, self);
    
    self.filterWaitingQueue = ko.computed(function()
    {
         if (self.waitingQueueList()){
            var favoriteEntries = ko.observableArray();
             self.sortItemsAscending();
             favoriteEntries = self.waitingQueueList().entries();
             return favoriteEntries;
        }                                 
    }, self);
 
    self.sortItemsAscending = function() {
        self.waitingQueueList().entries(self.waitingQueueList().entries().sort(favComparator));                                   
    };
    
    // FIXME: foreach in html directly on array.
    self.incomingCallQueue = ko.computed(function()
    {
         if (self.incomingCallList()){
            var filteredEntries = ko.observableArray();
            
             ko.utils.arrayForEach(self.incomingCallList().entries(), function(entry) {
                 filteredEntries.push(entry);
             });
             return filteredEntries();
        }       
        
    }, self);

    // FIXME: foreach in html directly on array.
    self.clickedListItemPhoneNumbers = ko.computed(function()
    {
        if (self.clickedListItem() && self.clickedListItem().numbers()){
            var numbers = ko.observableArray();
            ko.utils.arrayForEach(self.clickedListItem().numbers(), function(number) {
                numbers.push(number);
            });

            return numbers();
        } else {
            return [];
        }

    }, self);
    
    self.clickItem = function(clickedItem) {

        self.clickedListItem(clickedItem);
        var name = clickedItem.name();
        self.clickedListItemName(name);

        console.log("Clicked user " + name);

        if (self.callingState() == "onhook") {
            dialing = true;
            selectingNumber = true;
            $('#selectNumberModal').modal({
                keyboard: true
            })
            return;
        }

        if ((phoneIp != "") && listingViewModel.connectedPhone()) {
            transfering = true;
            selectingNumber = true;
            $('#selectNumberModal').modal({
                keyboard: true
            })
        } else {
            dialing = true;
            selectingNumber = true;
            $('#selectNumberModal').modal({
                keyboard: true
            })
        }
    }

    self.clickedSecondRow = function(clickedItem) {
        self.clickedListItem(clickedItem);
        self.showUserNoteModal();
        console.log("Clicked note for user " + clickedItem.name());
    }
    
    self.mailTo = function(incomingCall)
    {
        self.incomingCallMailTo(incomingCall);
        var mailtoUrl = "mailto:?Subject=" + i18next.t("Call-back request") + ": " + incomingCall.descriptionWithNumber();
        $('<iframe src="'+mailtoUrl+'">').appendTo('body').css("display", "none");
    }

    self.logOut = function() {
        console.log("Logging out");
        logout();
        shortcutsActive = false;
        $("#nameInputField").focus();
        $("#loginSubmitBtn").prop("disabled",false);

        // Some more data-structures to reset
        self.favoriteList = ko.observable(null);
        self.phoneIp("");
        global = {};
    }

    self.markQueueFavorite = function(favorite)
    {
        console.log("Queue " + favorite.name() + " marked as favorite.");

        favorite.favorite(!favorite.favorite()); // Toggle
        QueueListItem.saveFavs(self.waitingQueueList().entries());
    }

    self.signInOut = function(queueListItem)
    {
        queueListItem.queueLogin(!queueListItem.signInOut());
    }
    
    self.actionCalling = function(item)
    {
        dialing = false;
        if (!self.clickedListItem()) return;

        var numberToCall = self.clickedListItem().ext().split(",")[0];
        if (numberToCall != "") {
            dialNumber(numberToCall);
        } else {
            console.log("Can't call user without extension.");
            alert( i18next.t("Can't call user without extension.") );
        }
        self.dismissCallModal();
    }

    self.actionSelectedContactNumber = function(item) {
        selectingNumber = false;
        if (!self.clickedListItem()) return;
        self.clickedListItem().ext(item.number);

        if (dialing) {
            self.actionCalling();
            /*$('#callModal').modal({
                keyboard: true
            })*/
            self.dismissSelectNumberModal();
        } else if (transfering) {
            $('#transferModal').modal({
                keyboard: true
            })
            self.dismissSelectNumberModal();

        }
    }

    self.togglePauseGlobally = function() {
        if (!self.pausedGlobally() && !self.allowPause()) {
            console.log("Users disallowed from pausing in this company. Not pausing.");
            return;
        }

        console.log("Global pause clicked. Setting global pause to: " + !self.pausedGlobally());
        self.setGloballyPaused(!self.pausedGlobally());
    }

    self.setGloballyPaused = function(value) {

        if (value) {
            conn.pauseAllQueues();
        } else {
            conn.unpauseAllQueues();

            // When unpausing, Remove any 'nawerktijd' entries that might be there.
            if (global.autoPauseItem) {
                removeAutopauseItemFromGui();
            }
        }
        self.pausedGlobally(value);
    }
    
    self.actionTransfer = function()
    {
        transfering = false;
        if (!self.clickedListItem()) return;
        var toCall = self.clickedListItem().ext().split(",")[0];
        transferToUser(toCall);
        self.dismissTransferModal();
        console.log("Transfering to:" + toCall);
    }

    self.actionTransferAttended = function()
    {
        transfering = false;
        self.callingState("transfer");
        if (!self.clickedListItem()) return;
        var toCall = self.clickedListItem().ext().split(",")[0];
        attendedtransferToUser(toCall);
        self.dismissTransferModal();
        self.showTransferEndModal();
        console.log("Attended transfer to:" + toCall);
    }
    
    self.cancelLogin = function()
    {

    }

    self.dismissModal = function(modalToDismiss, focusInputField) {
        modalToDismiss.modal('hide');
        dialing = false;
        transfering = false;
    }

    self.dismissTransferModal = function()
    {
        self.dismissModal($('#transferModal'));
        self.clickedListItem(null);
        self.search("");
    }
    
    self.showTransferEndModal = function()
    {
        $('#transferEndModal').modal('show');
    }
    
    self.dismissEndTransferModal = function()
    {
        self.dismissModal($('#transferEndModal'));
        self.clickedListItem(null);
    }
    
     self.dismissCallModal = function()
    {
        self.dismissModal($('#callModal'));
        self.clickedListItem(null);
    }

    self.dismissSelectNumberModal = function() {
        dialing = false;
        transfering = false;
        self.dismissModal($('#selectNumberModal'));
    }

    self.dismissLoginModal = function()
    {
        shortcutsActive = true;
        self.dismissModal($('#loginModal'));
        self.clickedListItem(null);
    }
    
     self.dismissKeypadModal = function()
    {
        shortcutsActive = true;
        keypadActive = false;
        self.dismissModal($('#keypadModal'));
        self.clickedListItem(null);
    }
     
    self.dismissShortcutModal = function()
    {
        self.dismissModal($('#shortcutModal'));
        self.clickedListItem(null);
    }

    self.dismissSettingsModal = function()
    {
        shortcutsActive = true;
        self.dismissModal($('#settingsModal'));
    }
    
    self.doPickup = function()
    {
        console.log("Pickup clicked");
        if (self.callingState() == "ringing") {
            pickupPhone();
        }
    }
    
    self.doHangup = function()
    {
        console.log("Hangup clicked");
        if ((self.callingState() == "ringing") || (self.callingState() == "calling")) {
            hangupPhone();
        }
    }
    
    self.doLogin = function()
    {
        console.log("Logging in as: " + self.loginName());
        login(self.loginName(), self.loginPass());

        $("#loginSubmitBtn").prop("disabled",true);
    }
    
    
    self.favoriteCssClass = function(fav)
    {
        if (fav == true) {
            return 'fa fa-star';
        } else {
            return 'fa fa-star-o';
        }    
    }
    
    self.signInOutCssClass = function(signInOut)
    {
        if (signInOut == true){
            return 'fa fa-sign-out';
            
        } else {
            return 'fa fa-sign-in';
        }
    }
    
    self.signInOutColor = function(entry)
    {
        var result = ""

         if (entry.warnForEmptyQueue()) {
             result = 'noboby-logged-in-warn';
         }

        if (entry.signInOut() == true){
            return result + ' logged-in-color';
        } else {
            return result + ' logged-out-color';
        }
    }

    self.userCssClass = function(entry)
    {
        if (entry.log() == true) {
            var cssClass = 'fa fa-check-circle';
            if (entry.avail()) {
                cssClass += " contact-available";
            } else if (entry.ringing()) {
                cssClass += " contact-ringing";
            } else {
                cssClass += " contact-on-phone";
            }
            return cssClass;
        } else if (entry.amImportedContact()) {
            return 'fa fa-male contact-imported';
        } else {
            return 'fa fa-circle contact-logged-out';
        }                                       
    };

    self.connectionCssClass = function(typeConnection)
    {
        if(typeConnection == false){
            return 'fa fa-arrow-circle-left';
        } else if (typeConnection == true){
            return 'fa fa-arrow-circle-right';
        } else {
          return '';
        }

    }
    
    self.actionStateCssClass = function( current )
    {
        if(self.callingState() == "ringing" && current == 'pick'){
             return 'btn btn-pickup';
        } else if (self.callingState() == "ringing" && current == 'hang'){
                return 'btn btn-hangup';
        } else if (self.callingState() == "calling" && current == 'hang'){
             return 'btn btn-hangup';
        } else if (self.callingState() == "transfer" && current =='transfer'){
            return 'btn btn-transfer';
        } else {
            return 'btn btn-inactive';
        }
    }

    self.firstRowCssClass = function( entry )
    {
        if (entry != null && entry !=""){
             return 'first-info-small';
        } else {
             return 'first-info-big';
        }
    }
    
    self.secondRowCssClass = function( entry )
    {
         if (entry != null && entry !=""){
             return 'second-info';
        } else {
             return 'invisible';
        }
    }
    
    self.showKeypad = function()
    {
        shortcutsActive = false;
        keypadActive = true;
        $('#keypadModal').modal({
                keyboard: true
            })
        self.clearNumber();       
    }

    self.showKeypadWithNumber = function(data)
    {
        if (!$('.modal[id!=keypadModal]').is(':visible')) {
            var rg = new RegExp(/[^\d]/g);
            var normalized = data.replace(rg, "");
            
            if(normalized){
                shortcutsActive = false;
                keypadActive = true;
                $('#keypadModal').modal({
                        keyboard: true
                    })
                self.numericInput(normalized);
            }
        }
    }

    $('#keypadModal').on('shown.bs.modal', function () {
       $("#keypadInputField").focus();
    })
    
    self.showLogin = function()
    {
        shortcutsActive = false;
        $('#loginModal').modal({
            keyboard: false
        })
        $("#nameInputField").focus();
    }
    
    $('#loginModal').on('shown.bs.modal', function () {
       
            $("#passwordInputField").focus();
    })
    
    self.showShortcuts = function()
     {
        if (listingViewModel.helpUrl() == "") {
            $('#shortcutModal').modal({
                keyboard: false
            })
        } else {
            var url = listingViewModel.helpUrl();
            console.log("Opening help url: " + url);
            eModal.iframe(url, "Help");
        }
    }

    self.showUserNoteModal = function()
    {
        shortcutsActive = false;
        $('#userNoteModal').modal({
            keyboard: false
        })
    }

    self.dismissUserNoteModal = function()
    {
        shortcutsActive = true;
        self.dismissModal($('#userNoteModal'));
        self.clickedListItem(null);
    }

    self.settingsClicked = function() {
        if(!self.amAdmin()) return;

        listingViewModel.vcardUploadFeedback("");
        shortcutsActive = false;
        $('#settingsModal').modal({
            keyboard: false
        })
    }

    self.downloadLogsClicked = function() {
        console.log("Clicked 'download logs'");

        var logs = myLogging.getLog();
        blob = new Blob([logs], {
            type: 'application/octet-stream'
        });

        // Create blob
        var url = URL.createObjectURL(blob);
        //window.open(url, '_blank', ''); // Open the blob, no filename though.

        // Create link
        var link = document.createElement("a");
        link.setAttribute("href",url);
        link.setAttribute("download", "bedienpost_" + new Date().toISOString() + ".log");

        // Click the link
        var event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(event);
    }
    
    self.enterNumber = function(nr)
    {
        self.numericInput(self.numericInput() + nr);
    }

    self.clearNumber = function()
    {
        self.numericInput("");
    }
  
    self.attendedTransfer = function()
    {
        console.log("Attended transfer clicked");

        self.callingState("transfer");
        var number = self.numericInput().replace(/\D/g,'');
        self.clickedListItemName(number);
        attendedtransferToUser(number);
        self.dismissKeypadModal();
        self.showTransferEndModal();
    }
    
    self.unattendedTransfer = function()
    {
        console.log("Unattended transfer clicked");

        var number = self.numericInput().replace(/\D/g,'');
        self.clickedListItemName(number);
        transferToUser(number);
        self.dismissKeypadModal();
    }
    
    self.call = function()
    {
        console.log("Call");

        var number = self.numericInput().replace(/\D/g,'');
        dialNumber(number);
        self.dismissKeypadModal();
    }
    
    self.finalizeTransfer = function()
    {
        console.log("Finalize attended transfer");

        if (self.callingState() == "transfer") {
            finishAttendedTransfer();
        }
        self.dismissEndTransferModal();
    }

    self.cancelTransfer = function()
    {
        console.log("Cancel attended transfer");

        if (self.callingState() == "transfer") {
            cancelAttendedTransfer();
            self.callingState("calling");
        }
        self.dismissEndTransferModal();
    }
    
    ko.bindingHandlers.numeric = {
        init: function (element, valueAccessor) {
            $(element).on("keydown", function (event) {
                // Allow: backspace, delete, tab, escape, and enter
                if (event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || event.keyCode == 13 ||
                    // Allow: Ctrl A en Ctrl
                    (event.keyCode == 86 && event.ctrlKey) ||  (event.keyCode == 86 && event.metaKey) ||
                    (event.keyCode == 65 && event.ctrlKey) ||  (event.keyCode == 65 && event.metaKey) ||
                    // Allow: shift +
                    (event.keyCode == 187 && event.shiftKey == true) ||
                    // Allow: home, end, left, right
                    (event.keyCode >= 35 && event.keyCode <= 39)) {
                
                    // let it happen, don't do anything
                    return;
                }
                else {
                    // Ensure that it is a number and stop the keypress
                    if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105)) {
                        event.preventDefault();
                    }
                }
            });
        }
    };
    
    ko.bindingHandlers.i18n = {
        update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
            var lang = self.language(); //need to use the  self.language(), so that update fires on change of it

            var key = allBindings.get('key'), 
                place = allBindings.get('place'),
                obj = allBindings.get('obj'),
                keytype = allBindings.get('keytype');

            var translation = self.gettext(key, obj);
            if (!translation && keytype !== "array") { 
                console.log("Did not find a match for key " + key); 
                return; 
            }

            switch(place){
                case "valueandtext":    element.setAttribute("value", key);
                case "text":            element.innerHTML = translation; break;
                case "placeholder":     element.setAttribute(place, translation); break;
                case "title": {
                    if (keytype === "array") {
                        var finalTran = "";
                        for (i = 0; i < key.length; i++) {
                            var tranval = self.gettext(key[i]);
                            
                            finalTran += tranval + " \n " + obj[i];
                            if (i < key.length - 1) { finalTran += "\n\n" }
                        }
                        translation = finalTran;
                    }
                    
                    element.setAttribute(place, translation);
                }
            }
        }
    }

    /* 
    * Region for receiving the phone number from the plugin's content script
    */
    var numberChangedHandler = function(event) {
        //empty the observable and set it again, since the user could click the same ph.number
        //if setting the observable without emptying, it won't open the dialpad when clicking same ph.number 
        self.receivedNumberFromExtension("");
        self.receivedNumberFromExtension(event.target.value);
    };

    document.getElementById('hiddennumberfromext').removeEventListener("numberchange", numberChangedHandler, false);
    document.getElementById('hiddennumberfromext').addEventListener("numberchange", numberChangedHandler, false);

    /* END - Region for receiving the phone number from the plugin's content script
    */

    self.gettext = function(key, obj){
        if (obj) {
            return i18next.t(key, obj);
        }
        return i18next.t(key);
    }

    self.setSearch = function(searchParam)
    {
        self.search(searchParam);
    }

    self.markUserFavorite = function(item) {
        console.log("Marking user favorite");

        if (item.user && !item.user.favorite()) {
            item.user.favorite(true);
            UserListItem.saveFavs(self.currentList().entries());
        }
    }

    self.unmarkUserFavorite = function(item) {
        console.log("Unmarking user favorite");

        if (item.fav && item.fav.favorite) {
            item.fav.favorite(false);
            UserListItem.saveFavs(self.currentList().entries());
        }
    }

    self.favoriteList( self.favFilteredItems()) ;
   
    self.setSearch("");

    self.currentList( xmppUserLists[0] );
    self.waitingQueueList( xmppWaitingQueueList[0] );
    self.incomingCallList( xmppIncomingCallList[0] );

    $( "#loginModal" ).keypress(function(e)
    {
        if ((e.which) == 13){
            self.doLogin();
        } 
    });
    
    $("#activecalls").on("mouseenter", function(){
        if ((phoneIp != "") && listingViewModel.connectedPhone()) {
            $(".overlay").stop(true, true).fadeIn(250);
        }

    });

    $("#activecalls").on("mouseleave", function(){

        $(".overlay").stop(true, true).fadeOut(250);

    });
    

    $("#submitBtn").click(function() {
         $("#submitBtn").toggleClass('active');
    });

    self.showButton = function(){
        if ((phoneIp != "") && listingViewModel.connectedPhone()) {
            $('.overlay').fadeIn(250); // slideDown(1000);
        }
    }
    
     self.hideButton = function(){
        $('.overlay').fadeOut(250);  // slideUp(1000);
    }

    //----------- NOTY ----------
    self.setTipInSettings = function() {
        $(".urltip").qtip({
            content: {
                text: `<p>${i18next.t("Following keys will be replaced:")}</p>
                        <p><i>$callerid</i> : ${i18next.t("filled with the phonenumber of the other endpoint, EG: '31881234567'")}</p>
                        <p><i>$callid</i>  : ${i18next.t("a unique generated identifier for this call")}</p>
                        <p><i>$queueid</i> : ${i18next.t("unique id of the queue")}</p>
                        <p><i>$duration</i> : ${i18next.t("duration in s")}</p>
                        <p><i>$username</i> : ${i18next.t("username of the logged on user")}</p>
                        <p><i>$userid</i> : ${i18next.t("unique identifier for the logged on user")}</p>`
            },
            style: {
                classes: "qtip-rounded qtip-bootstrap",
                width: 350		
            },
            position: {
                my: 'left center',
                at: 'center right'
            }
        });
    }
    //-------- END NOTY ---------

    /*$("#keypadModal").keyup(function (e) {
        if (e.keyCode == 13) {
            if (listingViewModel.callingState() == "onhook") {
                listingViewModel.call();
            } else {
                listingViewModel.unattendedTransfer();
            }
        }
    });*/

    /* Give lower-case chars */
    function matchesKey(key, targetChar) {
        return ((key == targetChar.charCodeAt(0)) || (key == (targetChar.charCodeAt(0) - 32)));
    }

    $(document).keypress(function (e) {

        if (!keypadActive && shortcutsActive) {
            // Process numeric keys
            var searchParam = self.search();
            searchParam += "";
            searchParam = searchParam.toLowerCase();
            var key = e.keyCode ? e.keyCode : e.which ? e.which : e.charCode;
            var list = null;
            if (!searchParam) {
                list = self.favFilteredItems();
            } else {
                list = self.filteredItems();
            }
            if ((key >= 48) && (key <= 57 )) {
                var shortcutKey = (e.which % 48);

                if (selectingNumber) {
                    var itemToClick = self.clickedListItemPhoneNumbers()[shortcutKey];
                    self.actionSelectedContactNumber(itemToClick);
                } else  if (list[shortcutKey] != null) {
                    var itemToClick = self.filteredItems()[shortcutKey];
                    self.clickItem(list[shortcutKey]);
                }
                e.preventDefault();
            }
        } else if (keypadActive) {
            // Keypad key-bindings
            if (matchesKey(e.which, "b")) {  // b for bellen
                self.call();
                console.log("Calling number");
                e.preventDefault();
            } else if (matchesKey(e.which, "a")) {  // a for attended transfer
                self.attendedTransfer();
                console.log("Attended transfer");
                e.preventDefault();
            } else if (matchesKey(e.which, "u")) {  // u for unattended transfer
                self.unattendedTransfer();
                console.log("Unattended transfer");
                e.preventDefault();
            }
            return;
        }



        if (!shortcutsActive)
            return;

        //console.log (e.which);
        //console.log (e.ctrlKey);
        //console.log (e.shiftKey);

        if (matchesKey(e.which, "e")) {         // E - help
            self.showShortcuts();
            e.preventDefault();
        } else if (matchesKey(e.which, "d")) {  // D - dialpad
            self.showKeypad();
            e.preventDefault();
        } else if (matchesKey(e.which, "n")) {  // P - pickup
            self.doPickup();
            e.preventDefault();
        } else if (matchesKey(e.which, "h")) {  // H - hangup
            self.doHangup();
            e.preventDefault();
        } else if (matchesKey(e.which, "b")) { /// B - bel
            self.actionCalling();
            e.preventDefault();
        } else if (matchesKey(e.which, "a")) { // A - attended transfer
            self.actionTransferAttended();
            e.preventDefault();
        } else if (matchesKey(e.which, "t")) {  // t - unattended Transfer
            self.actionTransfer();
            e.preventDefault();
        } else if (matchesKey(e.which, "s")) { // S - Focus zoekveld
            $("#inputField").focus();
            e.preventDefault();
        } else if (matchesKey(e.which, "p")) { // P - Pauze
            listingViewModel.togglePauseGlobally();
            e.preventDefault();
        }
    });

    var _dragged;
    /* Drag and Drop handling */
    ko.bindingHandlers.drag = {
        init: function(element, valueAccessor, allBindingsAccessor) {
            //set meta-data
            ko.utils.domData.set(element, "ko_drag_data", valueAccessor());
             var dragElement = element;
            var dragOptions = {
                helper: function() {
                    //debugger;
                    return $(this).clone()},
                revert: 'true',
               
                appendTo: 'body',
                containment: 'window',
                revertDuration: 100,
                start: function() {
                    _dragged = ko.utils.unwrapObservable(valueAccessor().value);
                },
               
                cursorAt: { top: 20 }
            };
            
            
            //combine options passed into binding (in dragOptions binding) with global options (in ko.bindingHandlers.drag.options)
            var options = ko.utils.extend(ko.bindingHandlers.drag.options, allBindingsAccessor.dragOptions);
            
            //$(dragElement).draggable(dragOptions);
            //initialize draggable
            $(element).draggable(dragOptions).disableSelection();
        },
        options: {}   
    };

    ko.bindingHandlers.drop = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
            //grab method
             var dropElement = $(element);
            var dropOptions = {
                drop: function(event, ui) {
                    valueAccessor().value(_dragged);
                }
            };
            dropElement.droppable(dropOptions);
           
            var action = ko.utils.unwrapObservable(valueAccessor());
            
            //combine options passed into binding (in dropOptions binding) with global options (in ko.bindingHandlers.drop.options)
            var options = ko.utils.extend(ko.bindingHandlers.drop.options, allBindingsAccessor().dropOptions);
            
            options.drop = function(event, ui) {
                //read meta-data off of dropped item 
                var data = ko.utils.domData.get(ui.draggable[0], "ko_drag_data");
                //execute our action
                action.call(viewModel, data);
            };
            
            //initialize droppable
            $(element).droppable(options);            
        },
        options: {}    
    };

    self.callNoteUrl.subscribeIgnoreServerUpdate(function(value) {		
        // Don't update on server until we haven't received new input for 5 seconds.		
        companySettings.callNoteUrl = value;		
        requestStoreCompanySettings();		
    });

    self.crmUrl.subscribeIgnoreServerUpdate(function(value) {
        // Don't update on server until we haven't received new input for 5 seconds.
        companySettings.crmUrl = value;
        requestStoreCompanySettings();
    });

    self.helpUrl.subscribeIgnoreServerUpdate(function(value) {
        // Don't update on server until we haven't received new input for 5 seconds.
        companySettings.helpUrl = value;
        requestStoreCompanySettings();
    });

    //TODO : Remove
    // self.afterCallUrl.subscribeIgnoreServerUpdate(function(value) {
    //     // Don't update on server until we haven't received new input for 5 seconds.
    //     companySettings.afterCallUrl = value;
    //     requestStoreCompanySettings();
    // });

    //TODO : Remove
    // self.customAuthHeader.subscribeIgnoreServerUpdate(function(value) {
    //     // Don't update on server until we haven't received new input for 5 seconds.
    //     companySettings.customAuthHeader = value;
    //     requestStoreCompanySettings();
    // });

    self.allowPause.subscribeIgnoreServerUpdate(function(value) {
        companySettings.allowPause = value;
        requestStoreCompanySettings();
    });

    self.logDownloadEnabled.subscribeIgnoreServerUpdate(function(value) {
        companySettings.logDownloadEnabled = value;
        requestStoreCompanySettings();
    });

    self.noteUpdated= function() {
        if (!self.clickedListItem()) return;
        self.clickedListItem().noteUpdated();
    }

    /*
     * VCard Upload
     */
    self.vcardFileData = ko.observable({
        file: ko.observable(), // will be filled with a File object
        // Read the files (all are optional, e.g: if you're certain that it is a text file, use only text:
        binaryString: ko.observable(), // FileReader.readAsBinaryString(Blob|File) - The result property will contain the file/blob's data as a binary string. Every byte is represented by an integer in the range [0..255].
        text: ko.observable(), // FileReader.readAsText(Blob|File, opt_encoding) - The result property will contain the file/blob's data as a text string. By default the string is decoded as 'UTF-8'. Use the optional encoding parameter can specify a different format.
        dataURL: ko.observable(), // FileReader.readAsDataURL(Blob|File) - The result property will contain the file/blob's data encoded as a data URL.
        arrayBuffer: ko.observable(), // FileReader.readAsArrayBuffer(Blob|File) - The result property will contain the file/blob's data as an ArrayBuffer object.

        // a special observable (optional)
        base64String: ko.observable() // just the base64 string, without mime type or anything else
    });
    self.vcardUploadFeedback = ko.observable("");

    self.vcardFileData().text.subscribe(function(text) {
        listingViewModel.vcardUploadFeedback("Uploading..");
        var data = new FormData();
        data.append("uploadedfile", self.vcardFileData().file());
        uploadVCard(data);
    });

    ko.bindingHandlers.drag.options = { helper: 'clone' };
    self.showLogin();
}

/* Disable shortcuts when search-field gets focus */
$("#inputField").focus(function() {
    shortcutsActive = false;
});

/* Enable shortcuts when search-field loses focus */
$("#inputField").blur(function() {
    shortcutsActive = true;
});

/* ESC to un-focus search-field */
$("#inputField").keydown(function (e) {
    if (e.keyCode == 27) {
        $("#inputField").blur();
    }
});

$("#shortcutModal").keydown(function (e) {
    if ((e.keyCode == 27) || (e.keyCode == 13)) {
        listingViewModel.dismissShortcutModal();
    }
});

/*
 * This function get's called when all XMPP-data has been retrieved.
 * Can be used for some GUI-initialisation based on remote data.
 */
function guiGotModel() {

    if (!model.users[Lisa.Connection.myUserId]) return;

    // Give a warning if the user is paused in all queues on startup.
    var myQueues = model.users[Lisa.Connection.myUserId].queues;
    var allPaused = _.size(myQueues) > 0 ? true : false;
    for (queueKey in myQueues) {
        var queue = myQueues[queueKey];
        allPaused = allPaused && queue.paused;
    }
    listingViewModel.showPauseAlert(allPaused);
}

var listingViewModel = new ListingsViewModel();
ko.applyBindings(listingViewModel);
$('.overlay').hide();

//------------------------------------
//This name is used by the web extension in order to track down all bedienpost tabs in the browser
//please do not remove/change this string, otherwise web extension won't be able to redirect calls
window.name = "bedienpost-app";
//------------------------------------
