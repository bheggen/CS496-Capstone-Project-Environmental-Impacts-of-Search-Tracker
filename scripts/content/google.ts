// get constants
import { IMPACTS } from "../constants"

let lastQuery: string | null = null; // for tracking the last query

// get the search query to see if it is a google search
function getGoogleQuery(): string | null {
    const url = new URL(location.href); // copies url for parsing
    const q = url.searchParams.get("q"); // pulls out what the user typed in their search, if it is not a search page this value will be null
    return q && q.trim().length ? q.trim() : null; // if q exists and is not empty, return the query string, otherwise, return null
}

// checks for valid queries and adds impact if needed
function onPossibleNavigation() {
    const q = getGoogleQuery(); // gets the query
    if (!q) return; // if it is empty, return
    if (q == lastQuery) return; // if it is a copy of the last query, return
    lastQuery = q; // make q the new lastQuery
    chrome.runtime.sendMessage({ // q is valid so we add the values
        type: "ADD_IMPACT",
        water: IMPACTS.google.watermL,
        co2: IMPACTS.google.co2g
    })
}

onPossibleNavigation(); // run on load

window.addEventListener("popstate", onPossibleNavigation); // detect if the user clicks back or forward

const _pushState = history.pushState; // saves the original URL in case google tries to update it
history.pushState = function (...args: any[]) { // override browser navigation
    const r = _pushState.apply(this, args as any); // let Google update history
    window.dispatchEvent(new Event("locationchange")); // event that signals that the URL changed
    return r; // return original
};
window.addEventListener("locationchange", onPossibleNavigation); // check if the search is new on a location change