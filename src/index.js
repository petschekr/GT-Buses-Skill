"use strict";

var APP_ID = "amzn1.ask.skill.77dd3b88-7567-495a-a983-7d9208daed1a";
// Because the API requires it for some reason
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36";
var DEFAULT_STOP = "techwood drive and bobby dodd way";
var ALL_ROUTES = ["red", "blue", "green", "trolley", "emory", "night", "naratep", "tech"];

var Alexa = require("alexa-sdk");
var requester = require("request");
var cheerio = require("cheerio");
var async = require("async");

var handlers = {
    "LaunchRequest": function () {
        this.emit(":ask", "Which Georgia Tech bus route and stop would you like the ETA for?", "Which bus route and stop would you like the ETA for?");
    },
    "BusTime": function () {
        var slots = this.event.request.intent.slots;
        var emit = this.emit;
        var stop = !!slots.Stop.value ? slots.Stop.value : DEFAULT_STOP;
        var stopTags = getStopTags(stop);
        if (stopTags === null) {
            console.log("Couldn't find stop tags for: '" + stop + "'");
            emit(":ask", "I couldn't find that bus stop. Please try again.", "Please try again.");
            return;
        }
        if (!slots.Bus.value) {
            // Provide all bus times for the stop
            emit(":tell", "I can't help you with that yet");
            
        }
        else {
            // Provide bus time for indicated route at the stop
            var busRoute = getBusRoute(slots.Bus.value);
            getBusTime(busRoute, stopTags, function (err, data) {
                if (err) {
                    emit(":tell", err);
                    return;
                }
                var phrases = [];
                var invalidCount = 0;
                for (var i = 0; i < data.length; i++) {
                    var subData = data[i];
                    if (subData === null) {
                        invalidCount++;
                    }
                    if (subData !== null && subData.predictions.length > 0) {
                        phrases.push("The next " + getSpokenBusName(busRoute) + " headed to " + subData.direction + " will arrive in " + subData.predictions[0] + " minutes");
                    }
                }
                if (invalidCount === data.length) {
                    emit(":tell", "The " + getSpokenBusName(busRoute) + " does not stop at " + stop);
                    return;
                }
                if (phrases.length === 0) {
                    emit(":tell", "The " + getSpokenBusName(busRoute) + " does not have predicted arrival times for " + stop);
                    return;
                }
                emit(":tell", phrases.join(". "));
            });
        }
    },
    "GetMessages": function () {
        var slots = this.event.request.intent.slots;
        var emit = this.emit;
        var filter = !!slots.Bus.value ? getBusRoute(slots.Bus.value) : null;
        getAlerts(filter, function (err, messageTexts) {
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
function getSpokenBusName(busRoute) {
    busRoute = busRoute.toLowerCase();
    switch (busRoute) {
        case "emory":
            return "emory shuttle";
        case "naratep":
            return "nara tep";
        case "tech":
            return "tech square express";
        case "trolley":
            return "tech trolley";
        case "night":
            return "midnight rambler";
        case "red":
            return "red bus";
        case "blue":
            return "blue bus";
        case "green":
            return "green bus";
        default:
            return busRoute;
    }
}
function getStopTags(stopName) {
    // Returns array of matching tags
    stopName = stopName.toLowerCase();
    switch (stopName) {
        case "14th street and state street":
        case "14th street and state":
            return ["14thstat"];
        case "14th street bus yard":
        case "bus yard":
        case "student competition center":
            return ["14thbusy_a"];
        case "8th street and hemphill avenue":
        case "8th and hemphill":
            return ["8thhemp"];
        case "academy of medicine":
            return ["wpe7mrt"];
        case "baker building":
            return ["bakebldg"];
        case "clough commons":
        case "clough":
            return ["cloucomm"];
        case "clifton road and gatewood road":
            return ["clifgate_e", "clifgate"];
        case "clifton road at wesley woods":
        case "wesley woods":
            return ["clifwesl_e", "clifwesl_g"];
        case "college of business":
            return ["duprmrt"];
        case "ferst drive and atlantic drive":
        case "ferst drive and atlantic":
            return ["fersatla", "fersatla_d"];
        case "ferst drive and fowler street":
        case "ferst drive and fowler":
            return ["fersfowl"];
        case "ferst drive and hemphill avenue":
        case "ferst drive and hemphill":
            return ["fershemp", "fershemp_ob", "fersherec", "fershemrt"];
        case "ferst drive and state street":
        case "ferst drive and state":
            return ["fersstat", "fersstat_ob"];
        case "fitten hall":
        case "fitten":
            return ["fitthall", "fitthall_a"];
        case "gcatt":
            return ["gcat"];
        case "glc":
            return ["glc"];
        case "hsrb":
            return ["hsrb_a", "hsrb_d"];
        case "hemphill avenue and 10th street":
        case "hemphill avenue and 10th":
            return ["10thhemp"];
        case "hemphill avenue and curran street":
        case "hemphill avenue and curran":
            return ["hempcurr"];
        case "klaus building":
        case "klaus":
            return ["klaubldg", "fersklau", "ferschrec", "ferschmrt"];
        case "marta midtown station":
        case "marta midtown":
        case "marta station":
        case "marta":
            // Commented out tags are for Emory Shuttle
            return ["marta_a", "mart_e", "marta_g"];
        case "mcmillian street and 8th street":
        case "mcmillian and 8th":
            return ["mcmil8th"];
        case "nara":
            return ["nara"];
        case "north avenue apartments":
            return ["naveapts_a"];
        case "piedmont road at atlanta botanical garden":
        case "piedmont road at atlanta botanical gardens":
        case "piedmont road":
        case "atlanta botanical garden":
        case "atlanta botanical gardens":
        case "piedmont park":
            return ["piedbota_e", "piedbota_g"];
        case "recreation center":
        case "crc":
            // MAKE UP YOUR DAMN MIND
            return ["creccent", "reccent", "reccent_ob", "ferstdr", "creccent_ob", "creccent_ib"];
        case "student center":
            return ["centrstud", "studcentr", "studcent", "studcent_ib"]
        case "tep":
            return ["tep_d"];
        case "tech tower":
            return ["ferstcher", "cherfers", "techtowe"];
        case "technology square":
        case "tech square":
            return ["techsqua", "techsqua_ib", "techsqua_ob"];
        case "techwood drive and 4th street":
        case "techwood drive and 4th":
            return ["tech4th", "4thtech", "tech4th_ob", "tech4th_ib"];
        case "techwood drive and 5th street":
        case "techwood drive and 5th":
            return ["tech5th", "5thtech", "tech5rec", "tech5mrt", "5thtech_ib"]
        case "techwood drive and bobby dodd way":
        case "techwood drive and bobby dodd":
        case "techwood drive and 3rd street":
        case "techwood drive and 3rd":
            // OK ACTUALLY WTF
            return ["techbob", "3rdtech"];
        case "techwood drive and north avenue":
        case "techwood drive and north":
        case "techwood drive and north ave":
            return ["technorth", "technorth_ob", "technorth_ib"]
        case "transit hub":
        case "hub":
            // ...
            return ["hubfers", "fershub", "tranhub", "tranhub_a", "tranhub_b", "tranhub_f"];
        case "woodruff memorial":
        case "woodruff":
            return ["woodmemo"];
        default:
            return null;
    }
}
function getBusTime(route, stops, cb) {
    async.map(stops, function (stop, asyncCallback) {
        var options = {
            url: "https://gtbuses.herokuapp.com/multiPredictions",
            qs: {
                "stops": route + "|" + stop
            },
            headers: {
                "User-Agent": USER_AGENT,
                "Cache-Control": "no-cache"
            }
        };
        requester(options, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                // Parse response
                var $ = cheerio.load(body);
                var output;
                if ($("Error").length === 0) {
                    // Stop exists for this bus route
                    output = {
                        "direction": $("direction").attr("title"),
                        "predictions": []
                    };
                    $("direction > prediction").each(function () {
                        output.predictions.push($(this).attr("minutes"));
                    });
                }
                else {
                    // Stop does not exist for this bus route
                    output = null;
                }
                asyncCallback(null, output);
            }
            else {
                console.error({
                    error: error,
                    response: response,
                    body: body
                });
                asyncCallback("An error occurred");
            }
        });
    }, cb);
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
