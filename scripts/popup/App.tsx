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
    const units = settings.units;

    // function to build icons
    const icons = useMemo(() => {
        return {
            water: chrome.runtime.getURL("ui/WaterIcon.png"),
            co2: chrome.runtime.getURL("ui/CO2Icon.png")
        };
    }, []);

    async function load() { // read from background.ts
        setError(null); // clear previous errors
        const [userRes, settingsRes, goalRes] = await Promise.all([
            chrome.runtime.sendMessage({ type: "GET_USER_DATA" }) as Promise<GetUserRes>,
            chrome.runtime.sendMessage({ type: "GET_SETTINGS" }) as Promise<GetSettingsRes>,
            chrome.runtime.sendMessage({ type: "GET_GOAL" }) as Promise<GetGoalRes>
        ]);

        if (!userRes.ok) { // check for errors
            setError(userRes.error);
            return;
        }
        if (!settingsRes.ok) {
            setError(settingsRes.error);
            return;
        }
        if (!goalRes.ok) {
            setError(goalRes.error);
            return;
        }

        setGoalState(goalRes.goal);
        setData(userRes.data); // save data
        setSettingsState(settingsRes.settings);
    }

    function parseYMD(ymd: string): number {
        // returns ms at local midnight (good enough for pacing)
        const [y, m, d] = ymd.split("-").map(Number);
        return new Date(y, m - 1, d).getTime();
    }

    function clamp01(x: number) {
        return Math.max(0, Math.min(1, x));
    }

    function sumDailyBetween(daily: Record<string, { water: number; co2: number }>, startYMD: string, endYMD: string) {
        const keys = Object.keys(daily).sort();
        let water = 0;
        let co2 = 0;
        for (const k of keys) {
            if (k < startYMD) continue;
            if (k > endYMD) break;
            water += daily[k]?.water ?? 0;
            co2 += daily[k]?.co2 ?? 0;
        }
        return { water, co2 };
    }

    function flOzToML(flOz: number) { return flOz * 29.5735295625; }
    function ozToG(oz: number) { return oz * 28.349523125; }

    async function saveGoal() {
        if (!goalDate) { setError("Please pick a target date."); return; }

        const w = Number(goalWaterInput);
        const c = Number(goalCo2Input);
        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(c) || c <= 0) {
            setError("Please enter positive numbers for water and CO₂.");
            return;
        }

        const todayYMD = new Date().toISOString().slice(0, 10); // ok for now
        const targetMs = parseYMD(goalDate);
        const startMs = parseYMD(todayYMD);
        if (targetMs <= startMs) { setError("Target date must be in the future."); return; }

        // store in base units
        const targetWater = units === "metric" ? w : flOzToML(w);
        const targetCo2 = units === "metric" ? c : ozToG(c);
        const baseWater = data?.water ?? 0;
        const baseCo2 = data?.co2 ?? 0;

        const next: Goal = {
            startDate: todayYMD,
            targetDate: goalDate,
            targetWater,
            targetCo2,
            baseWater,
            baseCo2,
            active: true
        };

        const res = (await chrome.runtime.sendMessage({ type: "SET_GOAL", goal: next })) as SetGoalRes;
        if (!res.ok) { setError(res.error); return; }

        setGoalState(res.goal);
        setGoalOpen(false);
        setError(null);
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

    type Stats = {
        daily: Record<string, { water: number; co2: number }>;
        weekly: Record<string, { water: number; co2: number }>;
    };

    type GetStatsRes = { ok: true; stats: Stats } | { ok: false; error: string };

    type Goal = {
        startDate: string;   // YYYY-MM-DD
        targetDate: string;  // YYYY-MM-DD
        targetWater: number; // mL allowed from start -> targetDate
        targetCo2: number;   // g allowed from start -> targetDate
        baseWater: number;   // total water at the moment goal starts
        baseCo2: number;     // total co2 at the moment goal starts
        active: boolean;
    };
    type GetGoalRes = { ok: true; goal: Goal } | { ok: false; error: string };
    type SetGoalRes = { ok: true; goal: Goal } | { ok: false; error: string };
    type ClearGoalRes = { ok: true; goal: Goal } | { ok: false; error: string };

    const [statsOpen, setStatsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
    const [stats, setStats] = useState<Stats | null>(null);

    const [goal, setGoalState] = useState<Goal | null>(null);
    const [goalOpen, setGoalOpen] = useState(false);

    const [goalDate, setGoalDate] = useState("");
    const [goalWaterInput, setGoalWaterInput] = useState("");
    const [goalCo2Input, setGoalCo2Input] = useState("");

    async function loadStats() {
        const res = (await chrome.runtime.sendMessage({ type: "GET_STATS" })) as GetStatsRes;

        if (!res.ok) {
            setError(res.error);
            return;
        }
        setStats(res.stats);
    }

    async function openStats() {
        setStatsOpen(true);
        if (!stats) await loadStats();
    }

    useEffect(() => { // run load once
        load();
    }, []);

    useEffect(() => {
        if (!statsOpen) return;
        loadStats(); // immediate refresh
        const id = window.setInterval(loadStats, 1000);
        return () => window.clearInterval(id);
    }, [statsOpen, viewMode]);

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

            footer: { marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10 },

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

    // bar chart format
    function BarChart({
                          items,
                          valueKey,
                          color,
                          formatValue,
                          width = 292,
                          height = 120
                      }: {
        items: { label: string; water: number; co2: number }[];
        valueKey: "water" | "co2";
        color: string;
        formatValue: (v: number) => string;
        width?: number;
        height?: number;
    }) {
        // chart paddings
        const padL = 6;
        const padR = 6;
        const padTop = 10;
        const padBottom = 22;

        const plotW = width - padL - padR;
        const plotH = height - padTop - padBottom;

        if (!items.length) {
            return (
                <svg width={width} height={height} style={{ display: "block", opacity: 0.35 }}>
                    <line
                        x1={padL}
                        y1={padTop + plotH}
                        x2={padL + plotW}
                        y2={padTop + plotH}
                        stroke="rgba(255,255,255,0.18)"
                    />
                </svg>
            );
        }

        const max = Math.max(1, ...items.map(i => i[valueKey]));
        const barGap = 10;

        const rawBarW = Math.floor((plotW - barGap * (items.length - 1)) / items.length);
        const barW = Math.max(14, Math.min(rawBarW, 42));

        const groupW = barW * items.length + barGap * (items.length - 1);
        const startX = padL + Math.max(0, Math.floor((plotW - groupW) / 2));

        const baselineY = padTop + plotH;

        return (
            <svg width={width} height={height} style={{ display: "block" }}>
                <line
                    x1={padL}
                    y1={baselineY}
                    x2={padL + plotW}
                    y2={baselineY}
                    stroke="rgba(255,255,255,0.18)"
                />

                {items.map((it, idx) => {
                    const v = it[valueKey];
                    const h = Math.max(2, Math.round((v / max) * (plotH - 2)));

                    const x = startX + idx * (barW + barGap);
                    const y = baselineY - h;

                    return (
                        <g key={it.label}>
                            <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={h}
                                rx={8}
                                ry={8}
                                fill={color}
                            />

                            <text
                                x={x + barW / 2}
                                y={y - 4}
                                textAnchor="middle"
                                fontSize="9"
                                fill="rgba(255,255,255,0.65)"
                            >
                                {formatValue(v)}
                            </text>

                            <text
                                x={x + barW / 2}
                                y={height - 6}
                                textAnchor="middle"
                                fontSize="9"
                                fill="rgba(255,255,255,0.65)"
                            >
                                {it.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    }

    function lastNKeys(obj: Record<string, any>, n: number) {
        return Object.keys(obj).sort().slice(-n);
    }

    const modeMap = viewMode === "daily" ? stats?.daily : stats?.weekly;
    const keys = modeMap ? lastNKeys(modeMap, viewMode === "daily" ? 7 : 8) : [];
    const chartItems = keys.map(k => {
        const b = modeMap![k];
        const label = k.slice(5); // "MM-DD" for both daily/weekly for now

        const waterVal = units === "metric" ? b.water : mLtoFlOz(b.water);
        const co2Val = units === "metric" ? b.co2 : gToOz(b.co2);

        return { label, water: waterVal, co2: co2Val };
    });

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

    function dispWater(mL: number) {
        return units === "metric" ? `${mL.toFixed(1)} mL` : `${mLtoFlOz(mL).toFixed(2)} fl oz`;
    }
    function dispCo2(g: number) {
        return units === "metric" ? `${g.toFixed(3)} g` : `${gToOz(g).toFixed(3)} oz`;
    }

    const todayYMD = new Date().toISOString().slice(0, 10);

    const goalStatus = (() => {
        if (!goal?.active) return null;
        if (!data) return null;

        const startMs = parseYMD(goal.startDate);
        const endMs = parseYMD(goal.targetDate);
        const nowMs = parseYMD(todayYMD);

        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

        const frac = clamp01((nowMs - startMs) / (endMs - startMs));

        const usedWater = Math.max(0, data.water - goal.baseWater);
        const usedCo2 = Math.max(0, data.co2 - goal.baseCo2);

        const expectedWater = goal.targetWater * frac;
        const expectedCo2 = goal.targetCo2 * frac;

        return {
            usedWater,
            usedCo2,
            targetWater: goal.targetWater,
            targetCo2: goal.targetCo2,
            waterOver: usedWater > expectedWater,
            co2Over: usedCo2 > expectedCo2
        };
    })();

    function asNumber(v: unknown, fallback = 0) {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : fallback;
    }

    useEffect(() => {
        const onChanged = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string
        ) => {
            if (area !== "local") return;

            // totals update live
            if (changes.water || changes.co2) {
                setData(prev => {
                    const next: UserData = prev ?? { userId: "", water: 0, co2: 0 };

                    const water =
                        changes.water ? asNumber(changes.water.newValue, next.water) : next.water;

                    const co2 =
                        changes.co2 ? asNumber(changes.co2.newValue, next.co2) : next.co2;

                    return { ...next, water, co2 };
                });
            }

            // units update live
            if (changes.units) {
                const u = changes.units.newValue;
                if (u === "metric" || u === "us") {
                    setSettingsState({ units: u });
                }
            }

            // goal update live (only if you store it under "goal")
            if (changes.goal) {
                const g = changes.goal.newValue as Goal | null | undefined;
                setGoalState(g ?? null);
            }

            // stats update live (optional)
            if (changes.stats) {
                const s = changes.stats.newValue as Stats | null | undefined;
                setStats(s ?? null);
            }
        };

        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, []);

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

            {statsOpen && (
                <div style={{ ...styles.settingsPanel, marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 650 }}>Stats</div>
                        <button style={styles.button} onClick={() => setStatsOpen(false)}>
                            Close
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                            style={{
                                ...styles.button,
                                ...(viewMode === "daily" ? { borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.10)" } : {})
                            }}
                            onClick={() => setViewMode("daily")}
                        >
                            Daily
                        </button>
                        <button
                            style={{
                                ...styles.button,
                                ...(viewMode === "weekly" ? { borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.10)" } : {})
                            }}
                            onClick={() => setViewMode("weekly")}
                        >
                            Weekly
                        </button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Water</div>
                        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                            <BarChart
                                items={chartItems}
                                valueKey="water"
                                color="rgba(56,124,255,0.45)"
                                formatValue={(v) => units === "metric" ? v.toFixed(1) : v.toFixed(2)}
                            />
                        </div>

                        <div style={{ fontSize: 11, opacity: 0.7, margin: "10px 0 6px" }}>CO₂</div>
                        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                            <BarChart
                                items={chartItems}
                                valueKey="co2"
                                color="rgba(170,150,255,0.35)"
                                formatValue={(v) => v.toFixed(3)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {goalStatus && (
                <div style={{ ...styles.settingsPanel, marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
                        Goal (by {goal!.targetDate})
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <div>Water used</div>
                        <div style={{ color: goalStatus.waterOver ? "#ff6b6b" : "#4ade80", fontWeight: 650 }}>
                            {dispWater(goalStatus.usedWater)} / {dispWater(goalStatus.targetWater)}
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
                        <div>CO₂ used</div>
                        <div style={{ color: goalStatus.co2Over ? "#ff6b6b" : "#4ade80", fontWeight: 650 }}>
                            {dispCo2(goalStatus.usedCo2)} / {dispCo2(goalStatus.targetCo2)}
                        </div>
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
                        Totals so far: {dispWater(data!.water)} and {dispCo2(data!.co2)}
                    </div>
                </div>
            )}

            {goalOpen && (
                <div style={{ ...styles.settingsPanel, marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 8 }}>Set a goal</div>

                    <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ fontSize: 12, opacity: 0.85, display: "block" }}>
                            <div style={{ marginBottom: 4 }}>Target date</div>
                            <input
                                type="date"
                                value={goalDate}
                                onChange={(e) => setGoalDate(e.target.value)}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    marginTop: 4,
                                    padding: 8,
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#e7eaf0"
                                }}
                            />
                        </label>

                        <label style={{ fontSize: 12, opacity: 0.85, display: "block" }}>
                            <div style={{ marginBottom: 4 }}>
                                Water target ({units === "metric" ? "mL" : "fl oz"})
                            </div>
                            <input
                                inputMode="decimal"
                                value={goalWaterInput}
                                onChange={(e) => setGoalWaterInput(e.target.value)}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    marginTop: 4,
                                    padding: 8,
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#e7eaf0"
                                }}
                            />
                        </label>

                        <label style={{ fontSize: 12, opacity: 0.85, display: "block" }}>
                            <div style={{ marginBottom: 4 }}>
                                CO₂ target ({units === "metric" ? "g" : "oz"})
                            </div>
                            <input
                                inputMode="decimal"
                                value={goalCo2Input}
                                onChange={(e) => setGoalCo2Input(e.target.value)}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    marginTop: 4,
                                    padding: 8,
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#e7eaf0"
                                }}
                            />
                        </label>

                        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                            <button style={styles.button} onClick={saveGoal}>
                                Save
                            </button>

                            <button
                                style={{ ...styles.button, ...styles.buttonDanger }}
                                onClick={async () => {
                                    const res = (await chrome.runtime.sendMessage({ type: "CLEAR_GOAL" })) as ClearGoalRes;
                                    if (!res.ok) {
                                        setError(res.error);
                                        return;
                                    }
                                    setGoalState(res.goal);
                                    setGoalOpen(false);
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={styles.footer}>
                <button style={styles.button} onClick={() => setStatsOpen((v) => !v)}>
                    {statsOpen ? "Hide stats" : "Stats"}
                </button>

                <button style={styles.button} onClick={() => setGoalOpen((v) => !v)}>
                    {goalOpen ? "Hide goal" : "Goal"}
                </button>

                <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={reset}>
                    Reset totals
                </button>
            </div>
        </div>
    );
}