var incomingCallEntries = ko.observableArray();
var queueListEntries = ko.observableArray();
var userListEntries = ko.observableArray();

var xmppWaitingQueueList = [
    { name: "WaitingQueue List", entries: queueListEntries}
];
var xmppUserLists = [{ name: "Call List", entries: userListEntries }];
var xmppIncomingCallList = [{ name: "Incoming CallList", entries: incomingCallEntries }];