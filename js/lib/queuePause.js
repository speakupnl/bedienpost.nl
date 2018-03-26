(function() {

    /*
     * Attach library under QueuePause global.
     * Can be accessed as 'lib' within the library
     */
    var root = this;

    /*
     * Variables
     */

    var userUnpauseTimer = null;
    var _lastQueue = null;

    /*
     * Constructor
     * @arg conn        - LisaApi Connection.
     * @arg pauseTimes  - object in format {queueId: time-to-pause-in-seconds}.
     */
    var lib = root.QueuePause = function(conn, pauseTimes) {
        _.bindAll(this, 'modelReady', 'changePauseTimes', 'currentUserChanged', 'setPauseUnpauseObj');

        this.conn = conn;
        this.pauseTimes = {};                       // {queueId: 10}}

        this.pauseTimes = pauseTimes || {};
        this.pauseUnpauseObj = this.conn;

        conn.getModel().done(this.modelReady);

    };

    root.QueuePause.prototype.changePauseTimes = function(pauseTimes) {
        this.pauseTimes = pauseTimes;
    }

    root.QueuePause.prototype.modelReady = function() {
        listenToAllQueues();
        model.queueListObservable.addObserver(function() {
            listenToAllQueues(model);
        });

        this.conn.model.users[Lisa.Connection.myUserId].observable.addObserver(this.currentUserChanged);
    }

    /**
     * By default, the queuePause module effects pause and unpause by calling the pauseAllQueues and unpauseAllQueues
     * on the LisaApi connection object. This function allows to configure a different object for calling these functions.
     *
     * @param pauseUnpauseObj - the object on which pauseAllQueues() and unpauseAllQueues() will be called.
     */
    root.QueuePause.prototype.setPauseUnpauseObj = function(pauseUnpauseObj) {
        if (!pauseUnpauseObj) {
            Lisa.Connection.logging.log("AutoPause: setPauseUnpauseObj called without an object. - Not changing");
            return;
        }

        if ((typeof pauseUnpauseObj["pauseAllQueues"] === "function") && (typeof pauseUnpauseObj["unpauseAllQueues"] === "function")) {
            this.pauseUnpauseObj = pauseUnpauseObj;
        } else {
            Lisa.Connection.logging.log("AutoPause: setPauseUnpauseObj called with an object that doesn't have a pauseAllQueues and an unpauseAllQueues function.. - Not changing");
        }
    }

    function listenToAllQueues() {
        for (queueId in model.queues) {

            // the model.users array contains all users, keyed by user-id.
            var queue = model.queues[queueId];

            // Then, subscribe or re-subscribe to changes on the user.
            queue.observable.removeObserver(queueChanged);
            queue.observable.addObserver(queueChanged);
        }
    }

    /* One of the queues that we're watching has changed */
    function queueChanged(queue, type, item) {
           if (type == Lisa.Queue.EventTypes.CallRemoved) {
               var call = item;
               call.lastQueue = queue;
               Lisa.Connection.logging.log("AutoPause: Call " + call.id + " removed from queue " + queue.name + ". Setting lastQueue var for call");
           }
    }

    /**
     * Stop the automatic unpause-timer, for example because the user already unpaused himself manually.
     */
    root.QueuePause.prototype.stopUnpauseTimer = function() {
        Lisa.Connection.logging.log("AutoPause: Manually stopping wrap-up time for this user.");
        clearTimeout(userUnpauseTimer);
        userUnpauseTimer = null;
        _lastQueue.observable.notify(_lastQueue, "autoUnpaused");
        _lastQueue = null;
    }

    root.QueuePause.prototype.currentUserChanged = function (user, type, item) {
        var call = item;
        var lastQueue = call ? call.lastQueue : null;
        var pauseTime = lastQueue ? this.pauseTimes[lastQueue.id] : 0;  // Determine whether this queue has a pause-time.

        if ((type == Lisa.User.EventTypes.CallAdded)) {
            console.log("AutoPause: User " + user + " Received call " + call + " from queue " + lastQueue + ".");
            if (lastQueue) console.log("" + _.size(lastQueue.calls) + " calls left in queue " + lastQueue);
        }

        // No pause-time configured for queue. Return.
        if (!(pauseTime && (pauseTime > 0))) {
            console.log("AutoPause: No pauseTime configured or pauseTime is 0 for queue " + lastQueue + "... not pausing.");
            return;
        }

        if (type == Lisa.User.EventTypes.CallAdded /*&& !lastQueue.paused*/) {
            Lisa.Connection.logging.log("AutoPause: Pausing this user for all queues");
            this.pauseUnpauseObj.pauseAllQueues();
            //listingViewModel.setGloballyPaused(true);
            if (userUnpauseTimer != null) {
                Lisa.Connection.logging.log("AutoPause: timer already running, even though autoPause is triggered. Call pickup throught BLF? Making sure to stop any previous timers.");
                this.stopUnpauseTimer();
            }

        } else if (type == Lisa.User.EventTypes.CallRemoved) {
            
                // Staan er nog calls open met nawerktijd? Zo ja, don't start timer, maar laat de boel nog op pauze staan tot die calls ook afgerond zijn.
                for (var callKey in user.calls){
                    var otherCall = user.calls[callKey];
                    var otherLastQueue = otherCall["lastQueue"];
                    var otherPauseTime = (otherLastQueue) ? this.pauseTimes[otherLastQueue.id] : 0;
                    if (otherPauseTime > 0) {
                        console.log ("AutoPause: User still has other open calls from queues with an autoPause. Don't start the countdown timer for unpause yet, but start after the last call with autoPause has been handled.");
                        return;
                    }
                }

                // Staan we well op pauze? - zo niet, dan hoeven we ook niet van pauze af.
                /*if (!listingViewModel.pausedGlobally()) {
                    console.log ("AutoPause: User already unpaused, perhaps from earlier 'nawerktijd', pausing again.");
                    return;
                }*/

                Lisa.Connection.logging.log("AutoPause: Starting wrap-up time for this user for " + pauseTime + " seconds");
                lastQueue.observable.notify(lastQueue, "autoPaused", pauseTime, call);

                if (userUnpauseTimer != null) {
                    // Kill the previous timer first.
                    this.stopUnpauseTimer();
                }

                _lastQueue = lastQueue;
                userUnpauseTimer = _.delay(function(pauseUnpauseObj, queue) {
                    Lisa.Connection.logging.log("AutoPause: Wrap-up time expired, unpausing this user.");
                    pauseUnpauseObj.unpauseAllQueues();
                    //listingViewModel.setGloballyPaused(false);
                    queue.observable.notify(queue, "autoUnpaused");
                    userUnpauseTimer = null;
                    _lastQueue = null;
                }, pauseTime * 1000, this.pauseUnpauseObj, lastQueue);


        }
    }

}).call(this);