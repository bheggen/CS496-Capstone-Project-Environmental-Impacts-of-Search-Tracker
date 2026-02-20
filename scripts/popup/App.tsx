import React, { useEffect, useMemo, useState } from "react";

type UserData = { userId: string; water: number; co2: number };
type Units = "metric" | "us";
type Settings = { units: Units };

type GetUserRes = { ok: true; data: UserData } | { ok: false; error: string };
type GetSettingsRes = { ok: true; settings: Settings } | { ok: false; error: string };
type SetSettingsRes = { ok: true; settings: Settings } | { ok: false; error: string };

// conversions
function mLtoFlOz(mL: number) {
    // US fluid ounces
    return mL / 29.5735295625;
}
function gToOz(g: number) {
    return g / 28.349523125;
}

export default function App() { // define App
    const [data, setData] = useState<UserData | null>(null);
    const [settings, setSettingsState] = useState<Settings>({ units: "metric" });
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // function to build icons
    const icons = useMemo(() => {
        return {
            water: chrome.runtime.getURL("ui/WaterIcon.png"),
            co2: chrome.runtime.getURL("ui/CO2Icon.png")
        };
    }, []);

    async function load() { // read from background.ts
        setError(null); // clear previous errors
        const [userRes, settingsRes] = await Promise.all([ // get data from background
            chrome.runtime.sendMessage({ type: "GET_USER_DATA" }) as Promise<GetUserRes>,
            chrome.runtime.sendMessage({ type: "GET_SETTINGS" }) as Promise<GetSettingsRes>
        ]);

        if (!userRes.ok) { // check for errors
            setError(userRes.error);
            return;
        }
        if (!settingsRes.ok) {
            setError(settingsRes.error);
            return;
        }

        setData(userRes.data); // save data
        setSettingsState(settingsRes.settings);
    }

    // reset data function
    async function reset() {
        const ok = window.confirm("Are you sure you want to reset water and CO₂ totals to zero?"); // check for user confirmation
        if (!ok) return; // exit on user declining to reset

        setError(null);
        const res = (await chrome.runtime.sendMessage({ type: "RESET_IMPACT" })) as GetUserRes;

        if (!res.ok) {
            setError(res.error);
            return;
        }
        setData(res.data);
    }

    // function to toggle between metric and us
    async function toggleUnits() {
        const next: Settings = { units: settings.units === "metric" ? "us" : "metric" };
        setSettingsState(next);

        const res = (await chrome.runtime.sendMessage({
            type: "SET_SETTINGS",
            settings: next
        })) as SetSettingsRes;

        if (!res.ok) {
            setError(res.error);
            // revert if save failed
            setSettingsState(settings);
            return;
        }
        setSettingsState(res.settings);
    }

    useEffect(() => { // run load once
        load();
    }, []);

    // constant style formats
    const styles: Record<string, React.CSSProperties> = {
        root: {
            width: 320,
            padding: 14,
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            background: "#0f1115",
            color: "#e7eaf0"
        },
        header: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
        },
        titleWrap: { display: "flex", flexDirection: "column", gap: 2 },
        title: { margin: 0, fontSize: 16, fontWeight: 650, letterSpacing: 0.2 },
        sub: { fontSize: 11, opacity: 0.7 },

        iconButton: {
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#e7eaf0",
            cursor: "pointer",
            display: "grid",
            placeItems: "center"
        },

        card: {
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 12
        },

        row: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 6px",
            borderRadius: 10
        },

        left: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
        icon: { width: 22, height: 22, flex: "0 0 auto" },
        label: { fontSize: 12, opacity: 0.85 },

        value: {
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            whiteSpace: "nowrap"
        },

        divider: { height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" },

        error: {
            marginBottom: 10,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,80,80,0.35)",
            background: "rgba(255,80,80,0.08)",
            color: "#ffd6d6",
            fontSize: 12
        },

        footer: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

        button: {
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#e7eaf0",
            padding: "8px 10px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600
        },

        buttonDanger: { background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.35)" },

        settingsPanel: {
            marginTop: 10,
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.25)"
        },

        settingsRow: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10
        },

        toggle: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            opacity: 0.9
        }
    };

    const units = settings.units;

    // set up displays based on settings
    const waterDisplay =
        !data
            ? ""
            : units === "metric"
                ? `${data.water.toFixed(3)} mL`
                : `${mLtoFlOz(data.water).toFixed(3)} fl oz`;

    const co2Display =
        !data
            ? ""
            : units === "metric"
                ? `${data.co2.toFixed(3)} g`
                : `${gToOz(data.co2).toFixed(3)} oz`;

    return (
        <div style={styles.root}>
            <div style={styles.header}>
                <div style={styles.titleWrap}>
                    <h3 style={styles.title}>Conscious Search</h3>
                    <div style={styles.sub}>
                        {units === "metric" ? "Metric (mL, g)" : "US (fl oz, oz)"}
                    </div>
                </div>

                <button
                    style={styles.iconButton}
                    onClick={() => setSettingsOpen((v) => !v)}
                    aria-label="Settings"
                    title="Settings"
                >
                    {/* simple gear glyph */}
                    <span style={{ fontSize: 16, lineHeight: 1 }}>⚙️</span>
                </button>
            </div>

            {error && <div style={styles.error}>Error: {error}</div>}

            {!data ? (
                <div style={{ ...styles.card, fontSize: 12, opacity: 0.8 }}>Loading…</div>
            ) : (
                <div style={styles.card}>
                    <div style={styles.row}>
                        <div style={styles.left}>
                            <img src={icons.water} alt="Water" style={styles.icon} />
                            <div style={styles.label}>Water</div>
                        </div>
                        <div style={styles.value}>{waterDisplay}</div>
                    </div>

                    <div style={styles.divider} />

                    <div style={styles.row}>
                        <div style={styles.left}>
                            <img src={icons.co2} alt="CO2" style={styles.icon} />
                            <div style={styles.label}>CO₂</div>
                        </div>
                        <div style={styles.value}>{co2Display}</div>
                    </div>
                </div>
            )}

            {settingsOpen && (
                <div style={styles.settingsPanel}>
                    <div style={styles.settingsRow}>
                        <div style={{ fontSize: 12, fontWeight: 650 }}>Units</div>

                        <label style={styles.toggle}>
                            <input
                                type="checkbox"
                                checked={settings.units === "us"}
                                onChange={toggleUnits}
                            />
                            {settings.units === "us" ? "US" : "Metric"}
                        </label>
                    </div>
                </div>
            )}

            <div style={styles.footer}>
                <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={reset}>
                    Reset totals
                </button>
            </div>
        </div>
    );
}