import { EmbedBuilder, SlashCommandBuilder } from "@discordjs/builders";
import { randomID } from "../../utils.js";
import { ChannelType } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("class")
        .setDescription("Primary class management command")
        .addSubcommand(sc => sc
            .setName("create")
            .setDescription("Create a class")
            .addStringOption(o => o.setName("name").setDescription("name of the class").setRequired(true))
            .addStringOption(o => o.setName("symbol").setDescription("Symbol of the class. E.g. IST-166").setRequired(true).setMinLength(5))
            .addStringOption(o => o.setName("link").setDescription("a url to the class homepage"))
        )

        .addSubcommand(sc => sc
            .setName("delete")
            .setDescription("Delete a class")
            .addStringOption(o => o.setName("name").setDescription("name of the class to delete").setRequired(true).setAutocomplete(true))
        )

        .addSubcommand(sc => sc
            .setName("join")
            .setDescription("join a class")
            .addStringOption(o => o.setName("name").setDescription("name of the class you would like to join").setRequired(true).setAutocomplete(true))
        )

        .addSubcommand(sc => sc
            .setName("leave")
            .setDescription("leave a class")
            .addStringOption(o => o.setName("name").setDescription("name of the class you would like to join").setRequired(true).setAutocomplete(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "create") return await this.createCommand(interaction);
        if (subcommand == "delete") return await this.deleteCommand(interaction);
        if (subcommand == "join") return await this.joinCommand(interaction);
        if (subcommand == "leave") return await this.leaveCommand(interaction);
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused() ?? "";
        let classes = Object.values(interaction.guildData.classes).filter(c => c.name.toLowerCase().includes(focusedValue.toLowerCase()) || c.id.toLowerCase().includes(focusedValue.toLowerCase())).map(c => ({ name: `${c.name} (${c.symbol})`, value: c.id.toLowerCase() }));
        if (classes.length < 1) classes = [{ name: "There are no classes", value: "There are no classes" }];

        return await interaction.respond(classes);
    },

    async createCommand(interaction) {
        const className = interaction.options.getString("name");
        const classSymbol = interaction.options.getString("symbol");
        const link = interaction.options.getString("link");

        const failEmbed = this.failEmbed(interaction);

        if (Object.values(interaction.guildData.classes).find(c => c.name.toLowerCase() == className.toLowerCase() || c.symbol.toLowerCase() == classSymbol.toLowerCase())) {
            failEmbed.setDescription("Class already exists.")
            return await interaction.reply({ embeds: [failEmbed] }).catch(console.error);
        }

        const classDetails = await this.createClass(interaction, className, classSymbol, link);

        const responseEmbed = this.responseEmbed(interaction);
        responseEmbed.setDescription(`Class created. <#${classDetails.channel}>`);
        return await interaction.reply({ embeds: [responseEmbed] });
    },

    async deleteCommand(interaction) {
        const classID = interaction.options.getString("name");

        const failEmbed = this.failEmbed(interaction);

        if (!interaction.guildData.classes[classID.toLowerCase()]) {
            failEmbed.setDescription("Class does not exist.")
            return await interaction.reply({ embeds: [failEmbed] }).catch(console.error);
        }

        this.deleteClass(interaction, classID);

        const responseEmbed = this.responseEmbed(interaction);
        responseEmbed.setDescription(`Class deleted.`);
        return await interaction.reply({ embeds: [responseEmbed] });

    },

    async joinCommand(interaction) {
        const classID = interaction.options.getString("name");

        const failEmbed = this.failEmbed(interaction);
        if (!interaction.guildData.classes[classID.toLowerCase()]) {
            failEmbed.setDescription("Class does not exist.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        if (interaction.guildData.classes[classID.toLowerCase()].members.includes(interaction.member.id)) {
            failEmbed.setDescription("You've already joined this class.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        this.joinClass(interaction, classID);

        const responseEmbed = this.responseEmbed(interaction);
        responseEmbed.setDescription(`Successfully joined the \`${interaction.guildData.classes[classID.toLowerCase()].name}\` class.`);

        return await interaction.reply({ embeds: [responseEmbed] });
    },

    async leaveCommand(interaction) {
        const classID = interaction.options.getString("name");

        const failEmbed = this.failEmbed(interaction);
        if (!interaction.guildData.classes[classID.toLowerCase()]) {
            failEmbed.setDescription("Class does not exist.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        if (!interaction.guildData.classes[classID.toLowerCase()].members.includes(interaction.member.id)) {
            failEmbed.setDescription("You don't belong to this class.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        this.leaveClass(interaction, classID);

        const responseEmbed = this.responseEmbed(interaction);
        responseEmbed.setDescription(`Successfully left the \`${interaction.guildData.classes[classID.toLowerCase()].name}\` class.`);

        return await interaction.reply({ embeds: [responseEmbed] });
    },

    async createClass(interaction, className, classSymbol, link) {
        const guildData = interaction.guildData;
        const classIDs = Object.keys(guildData.classes);
        const ID = randomID(classIDs);

        const classObject = {
            id: ID,
            name: className,
            symbol: classSymbol,
            link,
            assignments: [],
            members: []
        }

        guildData.classes[ID.toLowerCase()] = classObject;

        const channelParent = guildData.options.classesCategory;
        const classChannel = await interaction.guild.channels.create({
            name: classSymbol,
            type: ChannelType.GuildText,
            parent: channelParent
        }).catch(console.error);

        const role = await interaction.guild.roles.create({
            name: classSymbol,
            reason: "Class created"
        }).catch(console.error);

        if (!classChannel) throw new Error("Could not create class channel");
        if (!role) throw new Error("Could not create role");

        classObject.channel = classChannel.id;
        classObject.role = role.id

        interaction.client.guildDb.set(interaction.guild.id, guildData.classes, "classes");

        return classObject;
    },

    async deleteClass(interaction, classID) {
        const classData = interaction.guildData.classes[classID.toLowerCase()];

        const channel = await interaction.guild.channels.fetch(classData.channel).catch(console.error);
        const role = await interaction.guild.roles.fetch(classData.role).catch(console.error);

        if (channel) channel.delete().catch(console.error);
        if (role) role.delete().catch(console.error);

        console.log(classID)
        delete interaction.guildData.classes[classID.toLowerCase()];
        interaction.client.guildDb.set(interaction.guild.id, interaction.guildData.classes, "classes");
        return true;
    },

    joinClass(interaction, classID) {
        interaction.guildData.classes[classID.toLowerCase()].members.push(interaction.member.id);
        interaction.client.guildDb.set(interaction.guild.id, interaction.guildData.classes, "classes");

        const classRole = interaction.guildData.classes[classID.toLowerCase()].role;
        if (classRole) {
            interaction.member.roles.add(classRole).catch(console.error);
        }
    },

    leaveClass(interaction, classID) {
        const index = interaction.guildData.classes[classID.toLowerCase()].members.findIndex(v => v == interaction.member.id);
        interaction.guildData.classes[classID.toLowerCase()].members.splice(index, 1);
        interaction.client.guildDb.set(interaction.guild.id, interaction.guildData.classes, "classes");

        const classRole = interaction.guildData.classes[classID.toLowerCase()].role;
        if (classRole) {
            interaction.member.roles.remove(classRole).catch(console.error);
        }
    },

    failEmbed(interaction) {
        return new EmbedBuilder()
            .setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL() })
            .setColor([204, 39, 29])
            .setTimestamp();
    },

    responseEmbed(interaction) {
        return new EmbedBuilder()
            .setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL() })
            .setColor([91, 113, 127])
            .setTimestamp();
    },
}