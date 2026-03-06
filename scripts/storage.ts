const STORE = chrome.storage.local; // using local chrome storage

// data housing a unique user ID with the total water that user has used and the
// CO2 they have produced with their searches
export type UserData = {
    userID: string;
    water: number;
    co2: number;
};

// for tracker date
export type DayKey = string;
export type WeekKey = string;

// for displaying weekly and daily stats
export type StatBucket = { water: number; co2: number };
export type Stats = {
    daily: Record<DayKey, StatBucket>;
    weekly: Record<WeekKey, StatBucket>;
};

const DEFAULTS: UserData = { // default values
    userID: "",
    water: 0,
    co2: 0
};

const DEFAULT_STATS: Stats = { daily: {}, weekly: {} };

// settings with defaults
export type Settings = { units: "metric" | "us" };
export const DEFAULT_SETTINGS: Settings = { units: "metric" };

// runs on startup, generating a userID if one does not already exist and
export async function initStorage(): Promise<UserData> {
    const data = (await STORE.get(DEFAULTS)) as UserData; // reads from chrome.storage or DEFAULTS If there is no data
    const { stats } = (await STORE.get({ stats: DEFAULT_STATS })) as { stats: Stats };
    const patch: Partial<UserData> = {}; // temporary storage to write missing data

    if (!data.userID) patch.userID = crypto.randomUUID(); // generates a random userID
    if (typeof data.water !== "number") patch.water = 0; // double check water and co2 have values
    if (typeof data.co2 !== "number") patch.co2 = 0;

    if (!stats || typeof stats !== "object") {
        await STORE.set({ stats: DEFAULT_STATS });
    }

    if (Object.keys(patch).length) { // check if any fields need to be updated
        await STORE.set(patch); // write the new patch
        return { ...data, ...patch } as UserData; // return existing and updated values
    }

    return data; // return existing data if no changes were made
}

// return user data
export async function getUserData(): Promise<UserData> {
    return (await STORE.get(DEFAULTS)) as UserData;
}

// basic set function
export async function setUserData(patch: Partial<UserData>): Promise<void> {
    const cleaned: Partial<UserData> = { ...patch }; // copy the patched data
    if (cleaned. water !== undefined) cleaned.water = Number(cleaned.water); // normalize
    if (cleaned.co2 !== undefined) cleaned.co2 = Number(cleaned.co2);
    await STORE.set(cleaned); // store the new data
}

// more robust set function
// reads, computes, writes, and returns new data
export async function addImpact(deltaWater: number, deltaCo2: number): Promise<UserData> {

    const { water, co2, stats } = (await STORE.get({
        water: 0,
        co2: 0,
        stats: DEFAULT_STATS
    })) as { water: number; co2: number; stats: Stats };

    const now = new Date();
    const dayKey = formatYMDInTZ(now);
    const weekKey = weekStartYMDInTZ(now);

    const nextStats: Stats = stats && typeof stats === "object"
        ? { daily: { ...stats.daily }, weekly: { ...stats.weekly } }
        : { daily: {}, weekly: {} };

    // Update daily bucket
    const dayBucket = nextStats.daily[dayKey] ?? { water: 0, co2: 0 };
    dayBucket.water += deltaWater;
    dayBucket.co2 += deltaCo2;
    nextStats.daily[dayKey] = dayBucket;

    // Update weekly bucket
    const weekBucket = nextStats.weekly[weekKey] ?? { water: 0, co2: 0 };
    weekBucket.water += deltaWater;
    weekBucket.co2 += deltaCo2;
    nextStats.weekly[weekKey] = weekBucket;

    // Update totals
    const nextTotals = { water: water + deltaWater, co2: co2 + deltaCo2 };

    // Persist everything
    await STORE.set({ ...nextTotals, stats: nextStats });

    const { userID } = (await STORE.get({ userID: "" })) as { userID: string };
    return { userID, ...nextTotals };
}

// function to reset all current values
export async function resetImpact(): Promise<UserData> {
    // make sure the userID is maintained
    const { userID } = (await STORE.get({ userID: "" })) as { userID: string };

    const patch = { water: 0, co2: 0 }; // reset water and co2
    await STORE.set(patch); // apply patch
    await STORE.set({ water: 0, co2: 0, stats: DEFAULT_STATS });

    return { userID, ...patch }; // return same userID, just resetting water and co2 values
}

// get stats
export async function getStats(): Promise<Stats> {
    const { stats } = (await STORE.get({ stats: DEFAULT_STATS })) as { stats: Stats };
    return stats ?? DEFAULT_STATS;
}

// get current settings
export async function getSettings(): Promise<Settings> {
    const { units } = (await STORE.get({ units: DEFAULT_SETTINGS.units })) as { units: Settings["units"] };
    return { units };
}

// set settings
export async function setSettings(next: Settings): Promise<Settings> {
    await STORE.set(next);
    return next;
}

const TZ = "America/Los_Angeles"; // constant time zone

// formats the date and time zone
function formatYMDInTZ(d: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(d);

    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const day = parts.find(p => p.type === "day")!.value;
    return `${y}-${m}-${day}`;
}

// Sets monday as the start of the week and formats weekly data
function weekStartYMDInTZ(d: Date): string {
    // Convert "now" to a date-like string in TZ, then rebuild as Date in local time.
    const ymd = formatYMDInTZ(d);
    const [Y, M, D] = ymd.split("-").map(Number);
    const localLike = new Date(Y, M - 1, D);

    const dow = localLike.getDay();
    const diffToMon = (dow + 6) % 7;
    localLike.setDate(localLike.getDate() - diffToMon);

    return formatYMDInTZ(localLike);
}