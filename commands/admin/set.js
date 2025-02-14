import { EmbedBuilder, SlashCommandBuilder } from "@discordjs/builders";

export default {
    data: new SlashCommandBuilder()
        .setName("set")
        .setDescription("settings management")

        .addSubcommand(sc => sc.setName("class-category").setDescription("Category for class channels to be created in").addChannelOption(o => o.setName("category").setDescription("category").setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "class-category") return await this.setClassCategory(interaction);
    },

    async setClassCategory(interaction) {
        const category = interaction.options.getChannel("category");
        const id = category.id;

        interaction.client.guildDb.set(interaction.guild.id, category.id, "options.classesCategory");

        return await interaction.reply("Class channel category successfully set.");
    }
}