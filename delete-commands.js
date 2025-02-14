// THIS WILL DELETE ALL COMMANDS. USE WITH CAUTION.
import { REST, Routes } from "discord.js";
import config from "./config.json" with {type: "json"};

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.token);

// and delete your commands
(async () => {
    try {
        console.log(`Started deleting application (/) commands.`);

        if (config.testing) {
            rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] }).then(() => console.info(`Successfully deleted application (/) commands.`))
        } else {
            // The put method is used to fully delete all commands in the guild with the current set
            rest.put(
                Routes.applicationCommands(config.clientId),
                { body: [] },
            ).then(data => {
                console.log(`Successfully deleted application (/) commands.`);
            });
        }
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();