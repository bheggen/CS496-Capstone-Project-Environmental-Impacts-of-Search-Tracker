const STORE = chrome.storage.local; // using local chrome storage

// data housing a unique user ID with the total water that user has used and the
// CO2 they have produced with their searches
export type UserData = {
    userID: string;
    water: number;
    co2: number;
};

const DEFAULTS: UserData = { // default values
    userID: "",
    water: 0,
    co2: 0
};

// runs on startup, generating a userID if one does not already exist and
export async function initStorage(): Promise<UserData> {
    const data = (await STORE.get(DEFAULTS)) as UserData; // reads from chrome.storage or DEFAULTS If there is no data

    const patch: Partial<UserData> = {}; // temporary storage to write missing data

    if (!data.userID) patch.userID = crypto.randomUUID(); // generates a random userID
    if (typeof data.water !== "number") patch.water = 0; // double check water and co2 have values
    if (typeof data.co2 !== "number") patch.co2 = 0;

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
    const { water, co2 } = (await STORE.get({ water: 0, co2: 0})) as { // read water and co2 values (defaulting to 0)
        water: number;
        co2: number;
    };

    const next = { water: water + deltaWater, co2: co2 + deltaCo2 }; // add new totals
    await STORE.set(next); // store new totals

    const { userID } = (await STORE.get({ userID: "" })) as { userID: string}; // get userID
    return { userID, ...next }; // return updated state
}