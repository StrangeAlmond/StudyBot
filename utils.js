// import userDataSchema from "./userDataSchema.json" with {type: "json"};
import guildDataSchema from "./guildDataSchema.json" with {type: "json"};
import _ from "lodash";

const newUser = (userDb, key, userID) => {
    console.info(`New User: ${userID}`);
    const userData = _.cloneDeep(userDataSchema);
    userData.userID = userID;
    return userDb.set(key, userData);
}

export const ensureUser = (userDb, key, userID) => {
    if (!userDb.has(key)) return newUser(userDb, key, userID);
    let userData = userDb.get(key);
    if (!_.isEqual(userData, _.merge(_.cloneDeep(userDataSchema), _.cloneDeep(userData)))) {
        userData = _.merge(_.cloneDeep(userDataSchema), _.cloneDeep(userData));
        userDb.set(key, userData);
        console.info(`Updating user ${userID} data to current schema...`);
    }
    return;
}

const newGuild = (guildDb, guildID) => {
    console.info(`New Guild: ${guildID}`);
    const guildData = _.cloneDeep(guildDataSchema);
    guildData.guildID = guildID;
    guildDb.set(guildID, guildData);
};

export const ensureGuild = (guildDb, guildID) => {
    if (!guildDb.has(guildID)) return newGuild(guildDb, guildID);
    let guildData = guildDb.get(guildID);
    if (!_.isEqual(guildData, _.merge(_.cloneDeep(guildDataSchema), _.cloneDeep(guildData)))) {
        guildData = _.merge(_.cloneDeep(guildDataSchema), _.cloneDeep(guildData));
        interaction.client.guildDb.set(guildID, guildData);
        console.info(`Updating guild ${guildID} data to current schema...`)
    }
    return;
};

export const randomID = (takenIDList) => {
    const id = Math.random().toString(36).substring(2, 8);
    if (takenIDList.includes(id)) return randomID();
    return id;
}