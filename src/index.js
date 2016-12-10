"use strict";

var APP_ID = "amzn1.ask.skill.77dd3b88-7567-495a-a983-7d9208daed1a";
// Because the API requires it for some reason
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36";

var Alexa = require("alexa-sdk");
var requester = require("request");
var cheerio = require("cheerio");

var handlers = {
    "LaunchRequest": function () {
        this.emit(":ask", "Which Georgia Tech bus route and stop would you like the ETA for?", "Which bus route and stop would you like the ETA for?");
    },
    "BusTime": function () {
        var slots = this.event.request.intent.slots;
        var busExists = !!slots.Bus.value;
        var stopExists = !!slots.Stop.value;
        var busRoute, stop;
        if (!busExists && !stopExists) {
            // Provide all bus times for default stop
            this.emit(":tell", "I can't help you with that yet");
        }
        else if (busExists && !stopExists) {
            // Provide bus time for indicated route for default stop
            busRoute = getBusRoute(slots.Bus.value);
            this.emit(":tell", "I can't help you with " + busRoute);
        }
        else if (!busExists && stopExists) {
            // Provide all bus times for indicated stop
            this.emit(":tell", "I can't help you with that yet");
        }
        else if (busExists && stopExists){
            // Provide bus time for indicated route at indicated stop
            busRoute = getBusRoute(slots.Bus.value);
            this.emit(":tell", "I can't help you with " + busRoute);
        }
    },
    "GetMessages": function () {
        var slots = this.event.request.intent.slots;
        var emit = this.emit;
        getAlerts(getBusRoute(slots.Bus.value), function (err, messageTexts) {
            if (err) {
                emit(":tell", err);
                return;
            }
            emit(":tell", messageTexts.join(" "));
        });
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "You can ask for a bus route and stop and I'll give you the ETA. For example, try asking when is the next red bus at North Avenue Apartments.", "Try asking for a bus route and stop.");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Try asking for a bus route and stop.", "Try asking for a bus route and stop.");
    }
};

function getBusRoute(busRouteName) {
    busRouteName = busRouteName.toLowerCase();
    switch (busRouteName) {
        case "emory shuttle":
            return "emory";
        case "nara tep":
            return "naratep";
        case "tech square express":
            return "tech";
        case "tech trolley":
            return "trolley";
        case "midnight rambler":
            return "night";
        default:
            return busRouteName;
    }
}
function getBusTime(route, stop, cb) {
    var options = {
        url: "https://gtbuses.herokuapp.com/messages",
        headers: {
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache"
        }
    };
}
function getAlerts(filter, cb) {
    var options = {
        url: "https://gtbuses.herokuapp.com/messages",
        headers: {
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache"
        }
    };
    requester(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            // Parse response
            var $ = cheerio.load(body);
            var messageTexts = [];
            var routes = $("route");
            if (filter) {
                routes = routes.filter('[tag="' + filter + '"]');
            }
            routes.find("text").each(function (i, el) {
                var message = $(this).text().replace(/^\d\. /, "");
                if (messageTexts.indexOf(message) === -1) {
                    messageTexts.push(message);
                }
            });
            cb(null, messageTexts);
        }
        else {
            console.error({
                error: error,
                response: response,
                body: body
            });
            cb("An error occurred");
        }
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
