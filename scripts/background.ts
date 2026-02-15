import { initStorage, getUserData, addImpact, resetImpact } from "./storage";
import { IMPACTS } from "./constants";

// on install or startup, storage is initialized, generating a userID if one does not exist and default values
chrome.runtime.onInstalled.addListener(async () => {
    await initStorage();
});

chrome.runtime.onStartup.addListener(async () => {
    await initStorage();
});

// define valid message types
type Msg =
    | { type: "GET_USER_DATA" }
    | { type: "ADD_IMPACT"; water: number; co2: number }
    | { type: "RESET_IMPACT" }
    | { type: "SEARCH_DETECTED"; provider: "google" | "chatgpt" };

// on a msg perform an action based on that message
chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
    (async () => {
        if (msg.type === "GET_USER_DATA") { // return user data
            const data = await getUserData();
            sendResponse({ ok: true, data });
            return;
        }

        if (msg.type === "ADD_IMPACT") { // updates user data given in the message
            const data = await addImpact(msg.water, msg.co2)
            sendResponse({ ok: true, data });
            return;
        }

        if (msg.type === "RESET_IMPACT") { // reset user date on message
            const data = await resetImpact();
            sendResponse({ ok: true, data });
            return;
        }

        if (msg.type === "SEARCH_DETECTED") { // increment on a search being detected
            const imp = IMPACTS[msg.provider]; // check message provider
            const data = await addImpact(imp.watermL, imp.co2g); // get constants
            sendResponse({ ok: true, data });
            return;
        }

        sendResponse({ ok: false, error: "Unknown message type" }); // error handling
    })();

    return true;
});