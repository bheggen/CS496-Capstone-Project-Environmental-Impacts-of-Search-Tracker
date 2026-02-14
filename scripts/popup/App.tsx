import React, { useEffect, useState } from "react";

type UserData = { userId: string; water: number; co2: number };

type GetRes = { ok: true; data: UserData } | { ok: false; error: string }; // ensure we read no data when there is an error

export default function App() { // define App
    const [data, setData] = useState<UserData | null>(null); // user data state
    const [error, setError] = useState<string | null>(null); // error state

    async function load() { // read from background.ts
        setError(null); // clear previous errors
        const res = (await chrome.runtime.sendMessage({ type: "GET_USER_DATA" })) as GetRes; // send a message to background to get data
        if (!res.ok) { // if background fails throw an error
            setError(res.error);
            return;
        }
        setData(res.data); // otherwise save the data
    }

    async function testAdd() { // test function to write test data
        setError(null);
        const res = (await chrome.runtime.sendMessage({ // sends test write request to background
            type: "ADD_IMPACT",
            water: 0.25,
            co2: 0.1
        })) as GetRes;

        if (!res.ok) {
            setError(res.error);
            return;
        }
        setData(res.data);
    }

    // reset data function
    async function reset() {
        const ok = window.confirm("Are you sure you want to reset water and CO₂ totals to zero?"); // check for user confirmation
        if (!ok) return; // exit on user declining to reset

        setError(null);
        const res = (await chrome.runtime.sendMessage({ type: "RESET_IMPACT" })) as GetRes;

        if (!res.ok) {
            setError(res.error);
            return;
        }
        setData(res.data);
    }

    useEffect(() => { // run load once
        load();
    }, []);

    return ( // ui
        <div style={{ width: "320", padding: 12, fontFamily: "system-ui, sans-serif" }}>
            <h3 style={{ margin: "0 0 8px" }}>Conscious Search</h3>

            {error && (
                <div style={{ marginBottom: 8, padding: 8, border: "1px solid #ccc" }}>
                    Error: {error}
                </div>
            )}

            {!data ? (
                <div>Loading…</div>
            ) : (
                <>
                    <div style={{ fontSize: 12, wordBreak: "break-all", opacity: 0.8 }}>
                        <div>Water: {data.water.toFixed(3)}</div>
                        <div>CO₂: {data.co2.toFixed(3)}</div>
                    </div>
                </>

            )}
            <button style={{ marginTop: 8 }} onClick={reset}>
                Reset totals
            </button>
        </div>
    );
}