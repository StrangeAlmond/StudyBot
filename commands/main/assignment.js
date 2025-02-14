import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from "@discordjs/builders";
import { randomID } from "../../utils.js";
import { ButtonStyle, MessageFlags, ThreadAutoArchiveDuration } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("assignment")
        .setDescription("Primary assigment management command")
        .addSubcommand(sc => sc
            .setName("create")
            .setDescription("Create an assigment")
            .addStringOption(o => o.setName("name").setDescription("Assignment name").setRequired(true).setMinLength(3))
            .addStringOption(o => o.setName("class").setDescription("The class which this assignment belongs to").setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName("due-date").setDescription("The date this assignment is due").setRequired(true))
            .addStringOption(o => o.setName("time").setDescription("The time this assignment is due. uses 24-hour time. format: hour:minute").setRequired(true))
            .addStringOption(o => o.setName("link").setDescription("A link to the assignment"))
        )

        .addSubcommand(sc => sc
            .setName("delete")
            .setDescription("Delete an assignment")
            .addStringOption(o => o.setName("id").setDescription("Assignment ID").setRequired(true))
            .addStringOption(o => o.setName("class").setDescription("Class name").setRequired(true).setAutocomplete(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "create") return await this.createCommand(interaction);
        if (subcommand == "delete") return await this.deleteCommand(interaction);
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused() ?? "";
        let classes = Object.values(interaction.guildData.classes).filter(c => c.name.toLowerCase().includes(focusedValue.toLowerCase()) || c.id.toLowerCase().includes(focusedValue.toLowerCase())).map(c => ({ name: `${c.name} (${c.symbol})`, value: c.id.toLowerCase() }));
        if (classes.length < 1) classes = [{ name: "There are no classes", value: "There are no classes" }];

        return await interaction.respond(classes);

    },

    async createCommand(interaction) {
        const name = interaction.options.getString("name");
        const classID = interaction.options.getString("class");
        const dueDate = interaction.options.getString("due-date");
        const dueTime = interaction.options.getString("time");
        const link = interaction.options.getString("link");

        const date = new Date(dueDate);

        const failEmbed = this.failEmbed(interaction);

        if (!date.getTime) {
            failEmbed.setDescription("Invalid due date.")
            return await interaction.reply({ embeds: [failEmbed] });
        }

        const dueTimeIsValid = /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/.test(dueTime);

        if (!dueTimeIsValid) {
            failEmbed.setDescription("Invalid due time.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        if (!interaction.guildData.classes[classID.toLowerCase()]) {
            failEmbed.setDescription("Invalid class.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        const classData = interaction.guildData.classes[classID.toLowerCase()];

        if (!interaction.member.roles.cache.find(r => r.name.toLowerCase() == classData.symbol.toLowerCase())) {
            failEmbed.setDescription("You must be in this class to create an assignment for it.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        if (link) {
            const linkIsValid = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi.test(link);
            if (!linkIsValid) {
                failEmbed.setDescription("Invalid Link");
                return await interaction.reply({ embeds: [failEmbed] });
            }
        }

        console.log(classID)

        const assignmentDetails = await this.createAssignment(interaction, name, classID, dueDate, dueTime, link);

        const responseEmbed = this.responseEmbed(interaction);

        responseEmbed.setDescription("Assignment created.");
        return await interaction.reply({ embeds: [responseEmbed] });
    },

    async deleteCommand(interaction) {
        const assignmentID = interaction.options.getString("name");
        const classID = interaction.options.getString("class");

        const failEmbed = this.failEmbed(interaction);

        if (!interaction.guildData.classes[classID.toLowerCase()]) {
            failEmbed.setDescription("Invalid class.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        if (!interaction.member.roles.cache.find(r => r.name.toLowerCase() == "trusted")) {
            failEmbed.setDescription("Invalid Perms.")
            return await interaction.reply({ embeds: [failEmbed] });
        }

        this.deleteAssignment(interaction, assignmentID, classID);
        const embed = this.responseEmbed(interaction);
        embed.setDescription("You have successfully deleted this assignment.");
        return await interaction.reply({ embeds: [embed] });
    },

    async createAssignment(interaction, name, classID, dueDate, dueTime, link) {
        const dueTimeMs = new Date(`${dueDate} ${dueTime}`);
        if (!dueTimeMs.getTime) throw new Error("Could not resolve due date time");

        const guildData = interaction.client.guildDb.get(interaction.guild.id);
        const assignmentIDs = guildData.classes[classID.toLowerCase()].assignments.map(a => a.id);

        const assignmentObject = {
            id: randomID(assignmentIDs),
            name,
            className: classID,
            dueTime: dueTimeMs.getTime(),
            link,
            subscribedMembers: []
        };

        guildData.classes[classID.toLowerCase()].assignments.push(assignmentObject);
        interaction.client.guildDb.set(interaction.guild.id, guildData.classes, "classes");

        let guildChannel = await interaction.guild.channels.fetch(guildData.classes[classID.toLowerCase()].channel);
        if (!guildChannel) {
            const guildChannels = await interaction.guild.channels.fetch();
            guildChannel = guildChannels.find(c => c.name.toLowerCase() == guildData.classes[classID.toLowerCase()].symbol.toLowerCase())
        }

        if (!guildChannel) throw new Error("Could not find class channel");

        const embed = this.responseEmbed(interaction);
        embed
            .setAuthor({ name: `${guildData.classes[classID].name} (${guildData.classes[classID].symbol})`, iconURL: interaction.guild.iconURL() })
            .setTitle(name)
            .addFields({ name: "Name", value: name, inline: true }, { name: "Due Date", value: `${dueTime.toLocaleString()}`, inline: true })
            .setFooter({ text: assignmentObject.id });

        const subscribeButton = new ButtonBuilder()
            .setCustomId(`assignment|subscribe|${assignmentObject.id}|${classID}`)
            .setLabel("Subscribe")
            .setStyle(ButtonStyle.Primary);

        const createThreadButton = new ButtonBuilder()
            .setCustomId(`assignment|createThread|${assignmentObject.id}|${classID}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Create Thread")

        const actionRow = new ActionRowBuilder()
            .setComponents(subscribeButton, createThreadButton);

        if (link) {
            const linkButton = new ButtonBuilder()
                .setLabel("Go to Assignment")
                .setStyle(ButtonStyle.Link)
                .setURL(link);

            actionRow.addComponents(linkButton);
        }

        guildChannel.send({ embeds: [embed], components: [actionRow] }).catch((err) => console.error(err));

        return assignmentObject;
    },

    deleteAssignment(interaction, assignmentID, classID) {
        const classData = interaction.guildData.classes[classID.toLowerCase()];
        const index = classData.assignments.findIndex(a => a.id.toLowerCase() == assignmentID.toLowerCase());
        if (!index) throw new Error("Could not find assignment");

        interaction.guildData.classes[classID.toLowerCase()].assignments.splice(index, 1);

        return true;
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

    async processButtons(interaction) {
        const customId = interaction.component.customId;
        const customIdSplit = customId.split("|");

        const failEmbed = this.failEmbed(interaction);

        const assignmentID = customIdSplit[2];
        const classID = customIdSplit[3];
        const classData = interaction.guildData.classes[classID.toLowerCase()];

        if (!classData) {
            failEmbed.setDescription("Could not find the class for the assignment.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        const assignmentData = classData.assignments.find(a => a.id.toLowerCase() == assignmentID.toLowerCase());
        const assignmentIndex = classData.assignments.findIndex(a => a.id.toLowerCase() == assignmentID.toLowerCase());

        if (!assignmentData) {
            failEmbed.setDescription("Could not find assignment.");
            return await interaction.reply({ embeds: [failEmbed] });
        }

        const responseEmbed = this.responseEmbed(interaction);

        if (customIdSplit[1] == "subscribe") {
            if (assignmentData.subscribedMembers.includes(interaction.member.id)) {
                interaction.guildData.classes[classID.toLowerCase()].assignments[assignmentIndex].subscribedMembers.splice(assignmentIndex, 1);
                responseEmbed.setDescription("You have unsubscribed from this assignment.");
            } else {
                interaction.guildData.classes[classID.toLowerCase()].assignments[assignmentIndex].subscribedMembers.push(interaction.member.id);
                responseEmbed.setDescription("You have subscribed to this assignment.");
            }

            interaction.client.guildDb.set(interaction.guild.id, interaction.guildData.classes, "classes");

            await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });

            return;
        }

        if (customIdSplit[1] == "createThread") {
            await interaction.deferUpdate();
            const thread = await interaction.channel.threads.create({
                name: assignmentData.name,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                reason: "Create thread button pushed for assignment"
            });

            interaction.guildData.classes[classID.toLowerCase()].assignments[assignmentIndex].thread = thread.id;
            interaction.client.guildDb.set(interaction.guild.id, interaction.guildData.classes, "classes");

            interaction.message.components[0].components[1].data.disabled = true;
            const embed = interaction.message.embeds[0].toJSON();

            embed.fields.push({ name: `Thread`, value: `${thread}`, inline: true });
            embed.description = "Thread has been created";

            await interaction.editReply({ embeds: [embed], components: interaction.message.components });
            await interaction.followUp({ content: `Thread has been created at ${thread}`, flags: MessageFlags.Ephemeral });
            return;
        }

    },

    twoDayDueDateReminder(channel, data) {
        channel.send(`### Attention Members\nYour subscribed assignment \`${data.name}\` is due in **two days**.\n\n-# ${data.subscribedMembers.map(m => `<@${m}>`).join(" | ")}`).catch(console.error);
    },

    twentyFourHourDueDateReminder(channel, data) {
        channel.send(`### Attention Members\nYour subscribed assignment \`${data.name}\` is due in **24 hours**.\n\n-# ${data.subscribedMembers.map(m => `<@${m}>`).join(" | ")}`).catch(console.error);
    }
}