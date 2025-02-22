import { REST, Routes } from "discord.js";
import config from "./config.json" with {type: "json"};
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory you created earlier
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		console.log(file)
		let command = await import(filePath);
		command = command.default
		if ('data' in command && 'execute' in command) {
			const commandData = command.data.toJSON()
			commands.push(commandData);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.token);


// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		if (config.testing) {
			rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands }).then(data => console.info(`Successfully reloaded ${data.length} application (/) commands.`))
		} else {
			// The put method is used to fully refresh all commands in the guild with the current set
			rest.put(
				Routes.applicationCommands(config.clientId),
				{ body: commands },
			).then(data => {
				console.log(`Successfully reloaded ${data.length} application (/) commands.`);
			});
		}
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
