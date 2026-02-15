console.log("[CS] chatgpt content script loaded"); // debug message

// ensures we only account for one query
let lastSendAt = 0; // store timestamp for last send
const DEDUPE_MS = 800; // minimum time

// send message while handling double counts
function registerChatGPTSearch() {
    const now = Date.now(); // get time
    if (now - lastSendAt < DEDUPE_MS) return; // check that the minimum time has passed
    lastSendAt = now; // store the new lastSend

    chrome.runtime.sendMessage({ type: "SEARCH_DETECTED", provider: "chatgpt" }); // tell background to increment
}

// check for key presses in the page
document.addEventListener(
    "keydown",
    (e) => {
        console.log("[CS] keydown", e.key, "shift?", e.shiftKey, "target=", (e.target as any)?.tagName); // debug message
        if (e.key !== "Enter") return; // look only for enter
        if (e.shiftKey) return; // ignore shift+enter
        if (e.isComposing) return; // ignore enter presses used to make other character

        const target = e.target as HTMLElement | null; // retrieve enter press
        if (!target) return;

        const isTextarea = target.tagName.toLowerCase() === "textarea"; // check if we are in a text area element when we press enter

        const isContentEditable = // check if we are in a content editable element when we press enter
            (target as any).isContentEditable || target.getAttribute?.("contenteditable") === "true" || !!target.closest?.('[contenteditable="true"]');

        if (isTextarea || isContentEditable) { // increment if either condition is true
            registerChatGPTSearch();
        }
    },
    true
);

// increment when the user triggers the send button in other cases
document.addEventListener(
    "submit",
    (_e) => {
        registerChatGPTSearch();
    },
    true
);

// increment when the user clicks the send button
document.addEventListener(
    "click",
    (e) => {
        const el = e.target as HTMLElement | null; // retrieve the click
        if (!el) return;

        const button = el.closest("button"); // find the closest button to the click
        if (!button) return;

        // check the attributes of the button
        const type = button.getAttribute("type");
        const aria = (button.getAttribute("aria-label") || "").toLowerCase();
        const text = (button.textContent || "").toLowerCase();

        // if it matches the send button, increment impact
        if (type === "submit" || aria.includes("send") || text.includes("send")) {
            registerChatGPTSearch();
        }
    },
    true
);
