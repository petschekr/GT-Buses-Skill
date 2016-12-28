import * as Alexa from "alexa-sdk";
import * as requester from "request";
import * as cheerio from "cheerio";

const APP_ID = "amzn1.ask.skill.77dd3b88-7567-495a-a983-7d9208daed1a";
// Because the API requires it for some reason
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36";
const DEFAULT_STOP = "techwood drive and bobby dodd way";
const ALL_ROUTES = ["red", "blue", "green", "trolley", "emory", "night", "naratep", "tech"];

interface NextBus {
    direction: string;
    predictions: string[];
}
interface Slots {
    Bus: {
        value: string | null;
    };
    Stop: {
        value: string | null;
    }
}

const states = {
    BUSROUTEMODE: "_BUSROUTEMODE",
    BUSSTOPMODE: "_BUSSTOPMODE"
};

let BusTimeHander = function () {
    let slots: Slots = this.event.request.intent.slots;
    if (slots.Bus.value && (slots.Bus.value.toLowerCase() === "any" || slots.Bus.value.toLowerCase() === "all routes")) {
        slots.Bus.value = null;
    }
    if (slots.Bus.value && getBusRoute(slots.Bus.value) === null) {
        // Invalid bus route
        this.emit(":ask", "That's not a valid bus route. Please try again.", "Please try again.");
        return;
    }
    if (slots.Stop.value) {
        processBusTime(this.emit, slots.Bus.value, slots.Stop.value);
    }
    else {
        // Ask the user for the stop
        this.handler.state = states.BUSSTOPMODE;
        this.attributes.busRoute = slots.Bus.value;
        let spokenBusName: string = slots.Bus.value ? `the ${getSpokenBusName(getBusRoute(slots.Bus.value)!)}` : "all routes";
        this.emit(":ask", `OK, ${spokenBusName}. Which bus stop or campus location?`, "Which bus stop or campus location?");
    }
};
let defaultSessionHanders = {
    "LaunchRequest": function () {
        this.handler.state = states.BUSROUTEMODE;
        this.emit(":ask", "Which Georgia Tech bus route would you like the ETA for?", "Which bus route?");
    },
    "BusTime": BusTimeHander,
    "GetMessages": async function () {
        let slots: Slots = this.event.request.intent.slots;
        let emit = this.emit;
        if (slots.Bus.value && getBusRoute(slots.Bus.value) === null) {
            // Invalid bus route
            this.emit(":ask", "That's not a valid bus route. Please try again.", "Please try again.");
            return;
        }
        let filter = !!slots.Bus.value ? getBusRoute(slots.Bus.value) : null;
        try {
            let messageTexts = await getAlerts(filter);
            if (messageTexts.length > 0) {
                let spokenBusName: string = filter ? `the ${getSpokenBusName(filter)}` : "all routes";
                messageTexts.unshift(`Here are the current service alerts for ${spokenBusName}:`);
            }
            else {
                let spokenBusName: string = filter ? `for the ${getSpokenBusName(filter)}` : "";
                messageTexts.push(`There are no current service alerts ${spokenBusName}`);
            }
            // Ampersands are incorrectly recognized as XML entities by Alexa unless escaped or changed to "and"
            emit(":tell", messageTexts.join(" ").replace(/&/g, " and "));
        }
        catch (err) {
            emit(":tell", err.message);
            console.warn(err);
        }
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "You can ask for a bus route and stop and I'll give you the ETA. For example, try asking when next red bus will arrive. You can also ask for current service alerts", "Try asking for a bus route.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "OK");
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "OK");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Try asking for a bus route.", "Try asking for a bus route.");
    }
};
let busRouteModeHandlers = Alexa.CreateStateHandler(states.BUSROUTEMODE, {
    "NewSession": function () {
        this.handler.state = "";
    },
    "BusTime": BusTimeHander,
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "Specify a bus route that you want the arrival times for or say any for all routes.", "Specify a bus route or say any for all routes.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "OK");
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "OK");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Try saying a bus route.", "Try saying a bus route.");
    }
});
let busStopModeHandlers = Alexa.CreateStateHandler(states.BUSSTOPMODE, {
    "NewSession": function () {
        this.handler.state = "";
    },
    "BusStop": function () {
        let slots: Slots = this.event.request.intent.slots;
        processBusTime(this.emit, this.attributes.busRoute, slots.Stop.value);
        this.handler.state = "";
        this.attributes.busRoute = null;
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "Specify a bus stop or location that you want the arrival times for.", "Specify a bus stop or location.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "OK");
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "OK");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Try saying a bus stop or location.", "Try saying a bus stop or location.");
    }
});

function getBusRoute(busRouteName: string): string | null {
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
        case "red":
        case "green":
        case "blue":
            return busRouteName;
        default:
            return null;
    }
}
function getSpokenBusName(busRoute: string): string {
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
function getStopTags(stopName: string): string[] | null {
    // Returns array of matching tags
    stopName = stopName.toLowerCase().replace(/^the /, "");
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
        case "howey physics":
        case "howey":
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
        case "midtown":
        case "marta station":
        case "marta":
            return ["marta_a", "mart_e", "marta_g"];
        case "mcmillian street and 8th street":
        case "mcmillian and 8th":
            return ["mcmil8th"];
        case "nara":
            return ["nara"];
        case "north avenue apartments":
        case "north avenue":
        case "north ave":
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
            return ["centrstud", "studcentr", "studcent", "studcent_ib"];
        case "tep":
            return ["tep_d"];
        case "tech tower":
            return ["ferstcher", "cherfers", "techtowe"];
        case "amazon":
        case "georgia tech hotel":
        case "georgia tech hotel and conference center":
        case "technology square":
        case "tech square":
            return ["techsqua", "techsqua_ib", "techsqua_ob"];
        case "techwood drive and 4th street":
        case "techwood drive and 4th":
            return ["tech4th", "4thtech", "tech4th_ob", "tech4th_ib"];
        case "techwood drive and 5th street":
        case "techwood drive and 5th":
            return ["tech5th", "5thtech", "tech5rec", "tech5mrt", "5thtech_ib"];
        case "bobby dodd stadium":
        case "bobby dodd":
        case "hopkins residence hall":
        case "hopkins hall":
        case "field residence hall":
        case "perry residence hall":
        case "hanson residence hall":
        case "matheson residence hall":
        case "glenn residence hall":
        case "towers residence hall":
        case "techwood drive and bobby dodd way":
        case "techwood drive and bobby dodd":
        case "techwood drive and 3rd street":
        case "techwood drive and 3rd":
            // OK ACTUALLY WTF
            return ["techbob", "3rdtech"];
        case "smith residence hall":
        case "techwood drive and north avenue":
        case "techwood drive and north":
        case "techwood drive and north ave":
        case "north avenue dining hall":
        case "north avenue dining":
        case "north ave dining hall":
        case "north ave dining":
            return ["technorth", "technorth_ob", "technorth_ib"];
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
function getStopName(stopName: string): string {
    stopName = stopName.toLowerCase().replace(/^the /, "");
    switch (stopName) {
        case "14th street and state":
            return "14th street and state street";
        case "bus yard":
        case "student competition center":
            return "14th street bus yard";
        case "8th and hemphill":
            return "8th street and hemphill avenue";
        case "clough":
            return "clough commons";
        case "wesley woods":
            return "clifton road at wesley woods";
        case "ferst drive and atlantic":
            return "ferst drive and atlantic drive";
        case "ferst drive and fowler":
            return "ferst drive and fowler street";
        case "ferst drive and hemphill":
            return "ferst drive and hemphill avenue";
        case "howey physics":
        case "howey":
        case "ferst drive and state":
            return "ferst drive and state street";
        case "fitten":
            return "fitten hall";
        case "hemphill avenue and 10th":
            return "hemphill avenue and 10th street";
        case "hemphill avenue and curran":
            return "hemphill avenue and curran street";
        case "klaus":
            return "klaus building";
        case "marta midtown":
        case "marta station":
        case "marta":
            return "marta midtown station";
        case "mcmillian and 8th":
            return "mcmillian street and 8th street";
        case "north avenue":
        case "north ave":
            return "north avenue apartments";
        case "piedmont road at atlanta botanical gardens":
        case "piedmont road":
        case "atlanta botanical garden":
        case "atlanta botanical gardens":
        case "piedmont park":
            return "piedmont road at atlanta botanical garden";
        case "recreation center":
        case "crc":
            return "the crc";
        case "student center":
            return "the student center";
        case "amazon":
        case "georgia tech hotel":
        case "georgia tech hotel and conference center":
        case "tech square":
            return "technology square";
        case "techwood drive and 4th":
            return "techwood drive and 4th street";
        case "techwood drive and 5th":
            return "techwood drive and 5th street";
        case "bobby dodd stadium":
        case "bobby dodd":
        case "hopkins residence hall":
        case "hopkins hall":
        case "field residence hall":
        case "perry residence hall":
        case "hanson residence hall":
        case "matheson residence hall":
        case "glenn residence hall":
        case "towers residence hall":
        case "techwood drive and bobby dodd":
        case "techwood drive and 3rd street":
        case "techwood drive and 3rd":
            return "techwood drive and bobby dodd way";
        case "smith residence hall":
        case "techwood drive and north":
        case "techwood drive and north ave":
        case "north avenue dining hall":
        case "north avenue dining":
        case "north ave dining hall":
        case "north ave dining":
            return "techwood drive and north avenue";
        case "transit hub":
        case "hub":
            return "the transit hub";
        case "woodruff":
            return "woodruff memorial";
        default:
            return stopName;
    }
}
async function processBusTime(emit: (...params: string[]) => void, route: string | null, stop: string | null) {
    let stopTags = getStopTags(stop || DEFAULT_STOP);
    if (stopTags === null) {
        console.log("Couldn't find stop tags for: '" + stop + "'");
        emit(":ask", "I couldn't find that bus stop. Please try again.", "Please try again.");
        return;
    }
    let stopName = getStopName(stop!);
    if (!route) {
        // Provide all bus times for the stop
        try {
            let routeDataPromises = ALL_ROUTES.map(async route => {
                return await Promise.all(getBusTime(route, stopTags!));
            });
            let routeData = await Promise.all(routeDataPromises);
            let phrases: string[] = [];
            for (let routeIndex = 0; routeIndex < routeData.length; routeIndex++) {
                let invalidCount = 0;
                for (let i = 0; i < routeData[routeIndex].length; i++) {
                    let subData: NextBus | null = routeData[routeIndex][i];
                    if (subData === null) {
                        invalidCount++;
                    }
                    if (subData !== null && subData.predictions.length > 0) {
                        phrases.push(`The next ${getSpokenBusName(ALL_ROUTES[routeIndex])} headed to ${subData.direction} will arrive in ${subData.predictions[0]} minute${(parseInt(subData.predictions[0], 10) === 1 ? "" : "s")}`);
                    }
                }
            }
            if (phrases.length === 0) {
                emit(":tell", `There are currently no predicted arrival times for ${stopName}`);
                return;
            }
            emit(":tell", `For ${stopName}: ${phrases.join(". ")}`);
        }
        catch (err) {
            emit(":tell", err.message);
            console.warn(err);
        }
    }
    else {
        // Provide bus time for indicated route at the stop
        // Won't be null because the route gets checked before this function is called
        let busRoute = getBusRoute(route)!;
        try {
            let data = await Promise.all(getBusTime(busRoute, stopTags));
            let phrases: string[] = [];
            let invalidCount = 0;
            for (let i = 0; i < data.length; i++) {
                let subData: NextBus | null = data[i];
                if (subData === null) {
                    invalidCount++;
                }
                if (subData !== null && subData.predictions.length > 0) {
                    phrases.push(`The next ${getSpokenBusName(busRoute)} headed to ${subData.direction} will arrive in ${subData.predictions[0]} minute${(parseInt(subData.predictions[0], 10) === 1 ? "" : "s")}`);
                }
            }
            if (invalidCount === data.length) {
                emit(":tell", `The ${getSpokenBusName(busRoute)} does not stop at ${stopName}`);
                return;
            }
            if (phrases.length === 0) {
                emit(":tell", `The ${getSpokenBusName(busRoute)} does not have predicted arrival times for ${stopName}`);
                return;
            }
            emit(":tell", `For ${stopName}: ${phrases.join(". ")}`);
        }
        catch (err) {
            emit(":tell", err.message);
            console.warn(err);
        }
    }
}

function getBusTime(route: string, stops: string[]): Promise<NextBus | null>[] {
    return stops.map((stop) => {
        let options = {
            url: "https://gtbuses.herokuapp.com/multiPredictions",
            qs: {
                "stops": route + "|" + stop
            },
            headers: {
                "User-Agent": USER_AGENT,
                "Cache-Control": "no-cache"
            }
        };
        return new Promise<NextBus | null>((resolve, reject) => {
            requester(options, (error, response, body: string) => {
                if (!error && response.statusCode === 200) {
                    // Parse response
                    let $ = cheerio.load(body);
                    let output: NextBus | null;
                    if ($("Error").length === 0) {
                        // Stop exists for this bus route
                        output = {
                            "direction": $("direction").attr("title"),
                            "predictions": []
                        };
                        $("direction > prediction").each(function () {
                            output!.predictions.push($(this).attr("minutes"));
                        });
                    }
                    else {
                        // Stop does not exist for this bus route
                        output = null;
                    }
                    resolve(output);
                }
                else {
                    console.error({
                        error: error,
                        response: response,
                        body: body
                    });
                    reject(new Error("An error occurred"));
                }
            });
        });
    });
}
function getAlerts(filter: string | null): Promise<string[]> {
    let options = {
        url: "https://gtbuses.herokuapp.com/messages",
        headers: {
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache"
        }
    };
    return new Promise<string[]>((resolve, reject) => {
        requester(options, (error, response, body: string) => {
            if (!error && response.statusCode === 200) {
                // Parse response
                let $ = cheerio.load(body);
                let messageTexts: string[] = [];
                let routes = $("route");
                if (filter) {
                    routes = routes.filter('[tag="' + filter + '"]');
                }
                routes.find("text").each((i, el) => {
                    let message = $(el).text().replace(/^\d\. /, "");
                    if (messageTexts.indexOf(message) === -1) {
                        messageTexts.push(message);
                    }
                });
                resolve(messageTexts);
            }
            else {
                console.error({
                    error: error,
                    response: response,
                    body: body
                });
                reject(new Error("An error occurred"));
            }
        });
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context, callback): void {
    let alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    //alexa.dynamoDBTableName = DYNAMO_TABLE;
    alexa.registerHandlers(defaultSessionHanders, busRouteModeHandlers, busStopModeHandlers);
    alexa.execute();
};
