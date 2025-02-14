import fs from "node:fs"
import path from 'node:path'
import { fileURLToPath } from "node:url";
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import Enmap from "enmap";
import config from "./config.json" with {type: "json"};
import Assignment from "./commands/main/assignment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildInvites] });

client.userDb = new Enmap({ name: "userDb" });
client.guildDb = new Enmap({ name: "guildDb" });
client.dbUserKey = (userId, guildId) => `${userId}-${guildId}`;

client.restarting = false;

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        import(filePath).then((command) => {
            command = command.default;
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        });
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    import(filePath).then(event => {
        event = event.default
        if (event.once) {
            client.once(event.name, async (...args) => await event.execute(...args));
        } else {
            client.on(event.name, async (...args) => await event.execute(...args));
        }
    })
}

setInterval(async () => {
    const guildsWithClasses = client.guildDb.keys().filter(k => Object.keys(client.guildDb.get(k).classes).length > 0);

    for (const key of guildsWithClasses) {
        let changesMade = false;
        const guildData = client.guildDb.get(key);

        for (const classID in guildData.classes) {
            const classData = guildData.classes[classID];

            if (classData.assignments.length < 1) continue;

            for (const assignment of classData.assignments) {
                const index = classData.assignments.indexOf(assignment);
                if (assignment.dueTime - Date.now() <= 24 * 60 * 60 * 1000 && !assignment.twentyFourHourWarningSent && assignment.subscribedMembers.length > 0) {
                    const guildObj = await client.guilds.fetch(key).catch(console.error);
                    if (!guildObj) continue;
                    const channelObj = await guildObj.channels.fetch(classData.channel).catch(console.error);
                    if (!channelObj) continue;

                    Assignment.twentyFourHourDueDateReminder(channelObj, assignment);

                    guildData.classes[classID].assignments[index].twentyFourHourWarningSent = true;
                    changesMade = true;
                    continue;
                }

                if (assignment.dueTime - Date.now() <= 2 * 24 * 60 * 60 * 1000 && !assignment.twoDayWarningSent && assignment.subscribedMembers.length > 0) {
                    const guildObj = await client.guilds.fetch(key).catch(console.error);
                    if (!guildObj) continue;
                    const channelObj = await guildObj.channels.fetch(classData.channel).catch(console.error);
                    if (!channelObj) continue;

                    Assignment.twoDayDueDateReminder(channelObj, assignment);

                    guildData.classes[classID].assignments[index].twoDayWarningSent = true;
                    changesMade = true;
                    continue;
                }

                if ((Date.now() - assignment.dueTime) >= 3 * 24 * 60 * 60 * 1000) {
                    console.info("Deleting expired assignment");
                    const guildObj = await client.guilds.fetch(key).catch(console.error);
                    if (!guildObj) continue;

                    if (assignment.thread) {
                        const thread = await guildObj.channels.fetch(thread).catch(console.error);
                        if (!thread) console.error(`Could not find assignment's thread.`);
                        thread.delete().catch(console.error);
                    }

                    guildData.classes[classID].assignments.splice(index, 1);
                    changesMade = true;
                }

            }

        }

        if (changesMade) client.guildDb.set(key, guildData.classes, "classes");
    }

}, 5000);

await client.login(config.token);

export const botRestarting = () => {
    return client.restarting = true;
};