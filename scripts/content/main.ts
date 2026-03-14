type ImpactDelta = { water: number; co2: number };
type Settings = { units: Units };

type Units = "metric" | "us";

function mLtoFlOz(mL: number) {
    return mL / 29.5735295625;
}
function gToOz(g: number) {
    return g / 28.349523125;
}

function showImpactPills(delta: ImpactDelta, settings: Settings) {
    // Create a container for displaying
    const id = "__cs_impact_container";
    let container = document.getElementById(id);
    if (!container) {
        container = document.createElement("div");
        container.id = id;
        Object.assign(container.style, {
            position: "fixed",
            top: "16px",
            right: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: "2147483647",
            pointerEvents: "none"
        });
        document.documentElement.appendChild(container);
    }

    const waterIcon = chrome.runtime.getURL("ui/WaterIcon.png"); // get icons
    const co2Icon = chrome.runtime.getURL("ui/CO2Icon.png");

    // create a pill shape for popup
    const makePill = (iconUrl: string, text: string) => {
        const pill = document.createElement("div");
        Object.assign(pill.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            borderRadius: "999px",
            background: "rgba(20,20,20,0.88)",
            color: "white",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: "12px",
            lineHeight: "1",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            width: "fit-content",
            maxWidth: "240px",
            overflow: "hidden",
            transformOrigin: "right center",
            willChange: "transform, opacity, width"
        } as Partial<CSSStyleDeclaration>);

        const img = document.createElement("img"); //format images
        img.src = iconUrl;
        Object.assign(img.style, {
            width: "20px",
            height: "20px",
            flex: "0 0 auto"
        });

        const label = document.createElement("div"); // format label
        label.textContent = text;
        Object.assign(label.style, {
            whiteSpace: "nowrap",
            opacity: "0.95"
        });

        pill.appendChild(img);
        pill.appendChild(label);

        return { pill, label };
    };

    // Format numbers
    const units = settings.units;

    const waterText =
        units === "metric"
            ? `+${delta.water.toFixed(1)} mL`
            : `+${mLtoFlOz(delta.water).toFixed(2)} fl oz`;

    const co2Text =
        units === "metric"
            ? `+${delta.co2.toFixed(3)} g`
            : `+${gToOz(delta.co2).toFixed(3)} oz`;

    // create the pills
    const water = makePill(waterIcon, waterText);
    const co2 = makePill(co2Icon, co2Text);

    // add them to the container
    container.appendChild(water.pill);
    container.appendChild(co2.pill);

    // Animations
    const animateOne = (node: HTMLDivElement, label: HTMLDivElement, delayMs: number) => {
        // fade in popups
        node.animate(
            [
                { transform: "translateX(20px)", opacity: 0 },
                { transform: "translateX(0px)", opacity: 1 }
            ],
            { duration: 250, easing: "ease-out", fill: "forwards", delay: delayMs }
        );

        // fade out
        window.setTimeout(() => {
            const fly = node.animate(
                [
                    { transform: "translateX(0px)", opacity: 1 },
                    { transform: "translateX(120px)", opacity: 0 }
                ],
                {
                    duration: 700,
                    easing: "cubic-bezier(.2,.8,.2,1)",
                    fill: "forwards"
                }
                );
            fly.onfinish = () => node.remove();
        }, 1200 + delayMs);
    };

    animateOne(water.pill, water.label, 0);
    animateOne(co2.pill, co2.label, 80);

    // Clean up container when empty
    window.setTimeout(() => {
        if (container && container.children.length === 0) container.remove();
    }, 2000);
}

// On detecting a search send a message to background and display info
function onSearchDetected(provider: "google" | "chatgpt") {
    try {
        if (!chrome?.runtime?.id) return;

        chrome.runtime.sendMessage({ type: "SEARCH_DETECTED", provider }, (res) => {
            if (chrome.runtime.lastError) return;
            if (res?.ok && res?.delta && res?.settings) {
                showImpactPills(res.delta, res.settings);
            }
        });
    } catch {
        // Ignore invalidated extension context during dev reloads
    }
}

function initGoogle() {
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
        onSearchDetected("google");
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
}

function initChatGPT() {

    // ensures we only account for one query
    let lastSendAt = 0; // store timestamp for last send
    const DEDUPE_MS = 800; // minimum time

    // send message while handling double counts
    function registerChatGPTSearch() {
        const now = Date.now(); // get time
        if (now - lastSendAt < DEDUPE_MS) return; // check that the minimum time has passed
        lastSendAt = now; // store the new lastSend
        onSearchDetected("chatgpt")
    }

    // check for key presses in the page
    document.addEventListener(
        "keydown",
        (e) => {
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
}

// router
(function main() {
    const host = location.hostname;

    if (host.endsWith("google.com")) initGoogle();
    if (host === "chatgpt.com" || host === "chat.openai.com") initChatGPT();
})();
