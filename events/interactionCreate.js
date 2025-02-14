import { Events } from "discord.js";
import { ensureGuild, ensureUser } from "../utils.js";
import assignment from "../commands/main/assignment.js";

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.guild) return;

        // ensureUser(interaction.client.userDb, userKey, interaction.member.id);
        ensureGuild(interaction.client.guildDb, interaction.guild.id);

        // const userData = interaction.client.userDb.get(userKey);
        const guildData = interaction.client.guildDb.get(interaction.guild.id);
        interaction.guildData = guildData;

        if (interaction.isButton()) return await this.handleButton(interaction);
        const command = interaction.client.commands.get(interaction.commandName);
        if (interaction.isCommand()) return await this.handleCommand(interaction);
        if (interaction.isAutocomplete()) return await this.handleAutocomplete(interaction, command);
    },
    async handleButton(interaction) {
        const customId = interaction.component.customId;

        if (customId.startsWith("assignment")) return await assignment.processButtons(interaction);
    },
    async handleCommand(interaction) {
        // const userKey = interaction.client.dbUserKey(interaction.member.id, interaction.guild.id);

        if ((!interaction.guildData.options.classesCategory || interaction.guildData.options.classesCategory.length < 1) && interaction.commandName != "set") {
            return await interaction.reply("Please set a category for class channels first.");
        }

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) return console.error(`${interaction.commandName} not found.`);

        try {
            console.info(`${interaction.member.displayName} (${interaction.member.id}): /${command.data.name} at ${Date.now()}`);
            await command.execute(interaction);
        } catch (error) {
            console.error(error);

            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp({
                    content: 'There was an error while executing this command, please contact <@356172624684122113>.',
                    ephemeral: true
                }).catch(console.error);
            }

            await interaction.reply({
                content: 'There was an error while executing this command, please contact <@356172624684122113>.',
                ephemeral: true
            }).catch(console.error)
        }
    },
    async handleAutocomplete(interaction, command, userData, guildData) {
        try {
            return await command.autocomplete(interaction, userData, guildData);
        } catch (error) {
            return console.error(error);
        }
    }
}