"use strict";

var APP_ID = "amzn1.ask.skill.77dd3b88-7567-495a-a983-7d9208daed1a";

var Alexa = require("alexa-sdk");
var requester = require("request");
var cheerio = require("cheerio");
/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * GTBuses is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var GTBuses = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
GTBuses.prototype = Object.create(AlexaSkill.prototype);
GTBuses.prototype.constructor = GTBuses;

GTBuses.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("GTBuses onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session init logic would go here
};

GTBuses.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("GTBuses onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

GTBuses.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("GTBuses onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session cleanup logic would go here
};

GTBuses.prototype.intentHandlers = {
    "BusTime": function (intent, session, response) {
        getBusTime(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        helpTheUser(intent, session, response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "";
        response.tell(speechOutput);
    }
};

/**
 * Returns the welcome response for when a user invokes this skill.
 */
function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var speechText = "Welcome to Georgia Tech Buses. Which bus route do you want the ETA for?";
    var repromptText = "<speak>Please choose a bus route by saying, " +
        "red <break time=\"0.2s\" /> " +
        "blue <break time=\"0.2s\" /> " +
        "tech trolley <break time=\"0.2s\" /> " +
        "midnight rambler</speak>";

    var speechOutput = {
        speech: speechText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.SSML
    };
    response.ask(speechOutput, repromptOutput);
}

/**
 * Gets the top sellers from Amazon.com for the given category and responds to the user.
 */
function getBusTime(intent, session, response) {
    var speechText = "",
        repromptText = "",
        speechOutput,
        repromptOutput;

    var busRouteName = intent.slots.Bus.value;

    // Find the lookup word for the given category.
    busRouteName = getBusRoute(busRouteName);

    if (busRouteName) {
         // There were no items returned for the specified item.
        speechText = "The next test bus arrives in 5 minutes.";
        speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
        // response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
    }
    else {
        // The category didn't match one of our predefined categories. Reprompt the user.
        speechText = "I'm not  what the bus route that is.";
        speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput, repromptOutput);
    }
}
function getBusRoute(busRouteName) {
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

/**
 * Instructs the user on how to interact with this skill.
 */
function helpTheUser(intent, session, response) {
    var speechText = "You can ask for the next bus time. " +
        "For example, when is the next red bus, or you can say exit. " +
        "Now, what can I help you with?";
    var repromptText = "<speak> I'm sorry I didn't understand that. You can say things like, " +
        "next tech trolley <break time=\"0.2s\" /> " +
        "next red bus. Or you can say exit. " +
        "Now, what can I help you with? </speak>";

    var speechOutput = {
        speech: speechText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.SSML
    };
    response.ask(speechOutput, repromptOutput);
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var GTBusHandler = new GTBuses();
    GTBusHandler.execute(event, context);
};
