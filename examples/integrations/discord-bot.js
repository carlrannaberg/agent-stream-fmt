#!/usr/bin/env node

/**
 * Discord Bot Integration Example
 *
 * This example demonstrates how to integrate agent-stream-fmt with Discord.js
 * to create a bot that processes and formats AI agent outputs in Discord channels.
 *
 * Features:
 * 1. Process JSONL data from message attachments
 * 2. Format output for Discord's message limits
 * 3. Interactive commands for different output formats
 * 4. Real-time processing status updates
 * 5. Support for multiple vendor formats
 *
 * Prerequisites:
 *   npm install discord.js
 *
 * Setup:
 *   1. Create a Discord application at https://discord.com/developers/applications
 *   2. Create a bot and get the token
 *   3. Set environment variable: DISCORD_TOKEN=your_bot_token
 *   4. Invite bot to your server with appropriate permissions
 *
 * Run this example:
 *   DISCORD_TOKEN=your_token node examples/integrations/discord-bot.js
 */

import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { createReadStream, writeFileSync } from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Check for required dependencies and environment
try {
  await import('discord.js');
} catch (error) {
  console.error('Missing dependency: discord.js');
  console.error('Install with: npm install discord.js');
  process.exit(1);
}

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable');
  console.error('Set it with: export DISCORD_TOKEN=your_bot_token');
  process.exit(1);
}

/**
 * Discord Bot Class
 */
class AgentStreamBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
    this.setupCommands();
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      console.log(`🤖 Bot logged in as ${this.client.user.tag}`);
      console.log(`📊 Serving ${this.client.guilds.cache.size} guilds`);

      // Set bot status
      this.client.user.setActivity('AI agent outputs', { type: 'WATCHING' });
    });

    this.client.on('messageCreate', async message => {
      if (message.author.bot) return;

      // Check for JSONL file attachments
      if (message.attachments.size > 0) {
        for (const attachment of message.attachments.values()) {
          if (attachment.name.endsWith('.jsonl')) {
            await this.handleJSONLAttachment(message, attachment);
          }
        }
      }

      // Check for inline JSONL data
      if (
        message.content.startsWith('```jsonl') &&
        message.content.endsWith('```')
      ) {
        const jsonlContent = message.content.slice(8, -3).trim();
        await this.processJSONLContent(message, jsonlContent);
      }
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      try {
        switch (interaction.commandName) {
          case 'format':
            await this.handleFormatCommand(interaction);
            break;
          case 'analyze':
            await this.handleAnalyzeCommand(interaction);
            break;
          case 'help':
            await this.handleHelpCommand(interaction);
            break;
        }
      } catch (error) {
        console.error('Command error:', error);
        const errorMessage = 'An error occurred while processing the command.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });
  }

  setupCommands() {
    // Register slash commands when bot is ready
    this.client.on('ready', async () => {
      const commands = [
        new SlashCommandBuilder()
          .setName('format')
          .setDescription(
            'Format JSONL data from the last attachment or message',
          )
          .addStringOption(option =>
            option
              .setName('vendor')
              .setDescription('AI vendor format')
              .setRequired(false)
              .addChoices(
                { name: 'Auto-detect', value: 'auto' },
                { name: 'Claude Code', value: 'claude' },
                { name: 'Gemini CLI', value: 'gemini' },
                { name: 'Amp Code', value: 'amp' },
              ),
          )
          .addStringOption(option =>
            option
              .setName('format')
              .setDescription('Output format')
              .setRequired(false)
              .addChoices(
                { name: 'Discord (default)', value: 'discord' },
                { name: 'Code block', value: 'code' },
                { name: 'Embed', value: 'embed' },
              ),
          )
          .addBooleanOption(option =>
            option
              .setName('hide_tools')
              .setDescription('Hide tool execution details')
              .setRequired(false),
          )
          .addBooleanOption(option =>
            option
              .setName('collapse_tools')
              .setDescription('Collapse tool output')
              .setRequired(false),
          ),

        new SlashCommandBuilder()
          .setName('analyze')
          .setDescription('Analyze JSONL data and show metrics')
          .addStringOption(option =>
            option
              .setName('vendor')
              .setDescription('AI vendor format')
              .setRequired(false)
              .addChoices(
                { name: 'Auto-detect', value: 'auto' },
                { name: 'Claude Code', value: 'claude' },
                { name: 'Gemini CLI', value: 'gemini' },
                { name: 'Amp Code', value: 'amp' },
              ),
          ),

        new SlashCommandBuilder()
          .setName('help')
          .setDescription('Show help information about the bot'),
      ];

      try {
        console.log('🔄 Registering slash commands...');
        await this.client.application.commands.set(commands);
        console.log('✅ Slash commands registered successfully');
      } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
      }
    });
  }

  async handleJSONLAttachment(message, attachment) {
    if (attachment.size > 8 * 1024 * 1024) {
      // 8MB limit
      await message.reply('❌ File too large. Maximum size is 8MB.');
      return;
    }

    const processingMessage = await message.reply(
      '🔄 Processing JSONL attachment...',
    );

    try {
      const response = await fetch(attachment.url);
      const jsonlContent = await response.text();

      await this.processJSONLContent(message, jsonlContent, processingMessage);
    } catch (error) {
      console.error('Error processing attachment:', error);
      await processingMessage.edit(
        '❌ Error processing attachment: ' + error.message,
      );
    }
  }

  async processJSONLContent(message, jsonlContent, statusMessage = null) {
    try {
      const input = Readable.from([jsonlContent]);

      // Quick analysis first
      const analysis = await this.analyzeJSONL(jsonlContent);

      if (statusMessage) {
        await statusMessage.edit(
          `🔄 Processing ${analysis.totalEvents} events...`,
        );
      }

      // Generate formatted output
      const formattedOutput = await this.formatForDiscord(jsonlContent, 'auto');

      if (statusMessage) {
        await statusMessage.delete();
      }

      // Send results
      await this.sendFormattedOutput(
        message.channel,
        formattedOutput,
        analysis,
      );
    } catch (error) {
      console.error('Error processing JSONL content:', error);
      const errorMessage = statusMessage || message;
      await errorMessage.reply('❌ Error processing JSONL: ' + error.message);
    }
  }

  async analyzeJSONL(jsonlContent, vendor = 'auto') {
    const input = Readable.from([jsonlContent]);
    const analysis = {
      totalEvents: 0,
      eventTypes: {},
      tools: { total: 0, successful: 0, names: [] },
      messages: { total: 0, byRole: {}, totalChars: 0 },
      costs: { total: 0, events: 0 },
      errors: [],
    };

    try {
      for await (const event of streamEvents({ vendor, source: input })) {
        analysis.totalEvents++;
        analysis.eventTypes[event.t] = (analysis.eventTypes[event.t] || 0) + 1;

        switch (event.t) {
          case 'msg':
            analysis.messages.total++;
            analysis.messages.byRole[event.role] =
              (analysis.messages.byRole[event.role] || 0) + 1;
            analysis.messages.totalChars += event.text.length;
            break;

          case 'tool':
            if (event.phase === 'start') {
              analysis.tools.total++;
              if (!analysis.tools.names.includes(event.name)) {
                analysis.tools.names.push(event.name);
              }
            } else if (event.phase === 'end' && event.exitCode === 0) {
              analysis.tools.successful++;
            }
            break;

          case 'cost':
            analysis.costs.total += event.deltaUsd;
            analysis.costs.events++;
            break;

          case 'error':
            analysis.errors.push(event.message);
            break;
        }
      }
    } catch (error) {
      analysis.errors.push(error.message);
    }

    return analysis;
  }

  async formatForDiscord(jsonlContent, vendor = 'auto', options = {}) {
    const input = Readable.from([jsonlContent]);
    const events = [];

    // Collect all events first
    for await (const event of streamEvents({ vendor, source: input })) {
      events.push(event);
    }

    // Format for Discord
    const sections = [];
    let currentSection = '';

    for (const event of events) {
      let line = '';

      switch (event.t) {
        case 'msg':
          const roleEmoji =
            { user: '👤', assistant: '🤖', system: '⚙️' }[event.role] || '❓';
          line = `${roleEmoji} **${event.role}**: ${event.text}`;
          break;

        case 'tool':
          if (event.phase === 'start') {
            line = `🔧 **Tool**: ${event.name}`;
          } else if (event.phase === 'end') {
            const status = event.exitCode === 0 ? '✅' : '❌';
            line = `${status} **${event.name}** finished (exit: ${event.exitCode})`;
          } else if (
            event.phase === 'stdout' &&
            event.text &&
            !options.hideTools
          ) {
            line = `\`\`\`\n${event.text.trim()}\n\`\`\``;
          }
          break;

        case 'cost':
          line = `💰 **Cost**: $${event.deltaUsd.toFixed(6)}`;
          break;

        case 'error':
          line = `❌ **Error**: ${event.message}`;
          break;
      }

      if (line) {
        // Check if adding this line would exceed Discord's message limit
        if ((currentSection + line + '\n').length > 1900) {
          if (currentSection) {
            sections.push(currentSection.trim());
          }
          currentSection = line + '\n';
        } else {
          currentSection += line + '\n';
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection.trim());
    }

    return sections;
  }

  async sendFormattedOutput(channel, sections, analysis) {
    // Send analysis summary first
    const embed = new EmbedBuilder()
      .setTitle('📊 JSONL Analysis Results')
      .setColor(0x007acc)
      .addFields(
        {
          name: 'Total Events',
          value: analysis.totalEvents.toString(),
          inline: true,
        },
        {
          name: 'Event Types',
          value:
            Object.entries(analysis.eventTypes)
              .map(([type, count]) => `${type}: ${count}`)
              .join('\n') || 'None',
          inline: true,
        },
        {
          name: 'Messages',
          value: `${analysis.messages.total} messages\n${analysis.messages.totalChars} characters`,
          inline: true,
        },
      );

    if (analysis.tools.total > 0) {
      embed.addFields({
        name: 'Tools',
        value: `${analysis.tools.total} executions\n${analysis.tools.successful} successful\nTools: ${analysis.tools.names.slice(0, 3).join(', ')}${analysis.tools.names.length > 3 ? '...' : ''}`,
        inline: true,
      });
    }

    if (analysis.costs.total > 0) {
      embed.addFields({
        name: 'Costs',
        value: `$${analysis.costs.total.toFixed(6)} total\n${analysis.costs.events} cost events`,
        inline: true,
      });
    }

    if (analysis.errors.length > 0) {
      embed.addFields({
        name: 'Errors',
        value: `${analysis.errors.length} errors encountered`,
        inline: true,
      });
    }

    await channel.send({ embeds: [embed] });

    // Send formatted sections
    if (sections.length === 0) {
      await channel.send('ℹ️ No formatted output to display.');
      return;
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const header =
        sections.length > 1 ? `**Part ${i + 1}/${sections.length}:**\n` : '';

      // Use code blocks for better formatting
      const message = header + section;

      try {
        await channel.send(message);

        // Add small delay between messages to avoid rate limiting
        if (i < sections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        await channel.send(
          `❌ Error sending part ${i + 1}: Message too long or invalid`,
        );
      }
    }
  }

  async handleFormatCommand(interaction) {
    await interaction.deferReply();

    const vendor = interaction.options.getString('vendor') || 'auto';
    const format = interaction.options.getString('format') || 'discord';
    const hideTools = interaction.options.getBoolean('hide_tools') || false;
    const collapseTools =
      interaction.options.getBoolean('collapse_tools') || false;

    // Look for JSONL data in recent messages
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    let jsonlContent = null;

    for (const message of messages.values()) {
      // Check attachments
      for (const attachment of message.attachments.values()) {
        if (attachment.name.endsWith('.jsonl')) {
          try {
            const response = await fetch(attachment.url);
            jsonlContent = await response.text();
            break;
          } catch (error) {
            console.error('Error fetching attachment:', error);
          }
        }
      }

      // Check inline JSONL
      if (!jsonlContent && message.content.includes('```jsonl')) {
        const match = message.content.match(/```jsonl\n([\s\S]*?)\n```/);
        if (match) {
          jsonlContent = match[1];
          break;
        }
      }

      if (jsonlContent) break;
    }

    if (!jsonlContent) {
      await interaction.followUp(
        '❌ No JSONL data found in recent messages. Upload a .jsonl file or paste JSONL data in a code block.',
      );
      return;
    }

    try {
      await interaction.followUp('🔄 Processing JSONL data...');

      const analysis = await this.analyzeJSONL(jsonlContent, vendor);
      const formattedOutput = await this.formatForDiscord(
        jsonlContent,
        vendor,
        {
          hideTools,
          collapseTools,
        },
      );

      await this.sendFormattedOutput(
        interaction.channel,
        formattedOutput,
        analysis,
      );
    } catch (error) {
      console.error('Format command error:', error);
      await interaction.followUp(
        '❌ Error processing JSONL data: ' + error.message,
      );
    }
  }

  async handleAnalyzeCommand(interaction) {
    await interaction.deferReply();

    const vendor = interaction.options.getString('vendor') || 'auto';

    // Look for JSONL data in recent messages (same logic as format command)
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    let jsonlContent = null;

    for (const message of messages.values()) {
      for (const attachment of message.attachments.values()) {
        if (attachment.name.endsWith('.jsonl')) {
          try {
            const response = await fetch(attachment.url);
            jsonlContent = await response.text();
            break;
          } catch (error) {
            console.error('Error fetching attachment:', error);
          }
        }
      }

      if (!jsonlContent && message.content.includes('```jsonl')) {
        const match = message.content.match(/```jsonl\n([\s\S]*?)\n```/);
        if (match) {
          jsonlContent = match[1];
          break;
        }
      }

      if (jsonlContent) break;
    }

    if (!jsonlContent) {
      await interaction.followUp('❌ No JSONL data found in recent messages.');
      return;
    }

    try {
      const analysis = await this.analyzeJSONL(jsonlContent, vendor);

      const embed = new EmbedBuilder()
        .setTitle('📊 Detailed JSONL Analysis')
        .setColor(0x28a745)
        .addFields(
          {
            name: 'Total Events',
            value: analysis.totalEvents.toString(),
            inline: true,
          },
          {
            name: 'Event Distribution',
            value:
              Object.entries(analysis.eventTypes)
                .map(
                  ([type, count]) =>
                    `${type}: ${count} (${((count / analysis.totalEvents) * 100).toFixed(1)}%)`,
                )
                .join('\n') || 'None',
            inline: false,
          },
        );

      if (analysis.messages.total > 0) {
        const avgLength = (
          analysis.messages.totalChars / analysis.messages.total
        ).toFixed(1);
        embed.addFields({
          name: 'Messages',
          value: `📝 ${analysis.messages.total} messages\n📏 ${avgLength} avg chars\n👥 Roles: ${Object.entries(
            analysis.messages.byRole,
          )
            .map(([r, c]) => `${r}(${c})`)
            .join(', ')}`,
          inline: true,
        });
      }

      if (analysis.tools.total > 0) {
        const successRate = (
          (analysis.tools.successful / analysis.tools.total) *
          100
        ).toFixed(1);
        embed.addFields({
          name: 'Tools',
          value: `🔧 ${analysis.tools.total} executions\n✅ ${successRate}% success rate\n🛠️ ${analysis.tools.names.length} unique tools`,
          inline: true,
        });
      }

      if (analysis.costs.total > 0) {
        const avgCost = (analysis.costs.total / analysis.costs.events).toFixed(
          6,
        );
        embed.addFields({
          name: 'Costs',
          value: `💰 $${analysis.costs.total.toFixed(6)} total\n📊 ${analysis.costs.events} cost events\n💸 $${avgCost} average`,
          inline: true,
        });
      }

      if (analysis.errors.length > 0) {
        embed.addFields({
          name: 'Errors',
          value: `❌ ${analysis.errors.length} errors\n🔍 First: ${analysis.errors[0].substring(0, 100)}${analysis.errors[0].length > 100 ? '...' : ''}`,
          inline: false,
        });
      }

      embed.setFooter({ text: `Analyzed with vendor: ${vendor}` });

      await interaction.followUp({ embeds: [embed] });
    } catch (error) {
      console.error('Analyze command error:', error);
      await interaction.followUp(
        '❌ Error analyzing JSONL data: ' + error.message,
      );
    }
  }

  async handleHelpCommand(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Agent Stream Formatter Bot Help')
      .setDescription(
        'I help format and analyze AI agent CLI outputs in Discord!',
      )
      .setColor(0x007acc)
      .addFields(
        {
          name: '📁 File Upload',
          value: "Upload .jsonl files and I'll automatically process them",
          inline: false,
        },
        {
          name: '💬 Inline JSONL',
          value:
            'Paste JSONL data in a code block:\n```jsonl\n{"type":"message",...}\n```',
          inline: false,
        },
        {
          name: '🎛️ Slash Commands',
          value:
            '`/format` - Format recent JSONL data\n`/analyze` - Analyze and show metrics\n`/help` - Show this help',
          inline: false,
        },
        {
          name: '🔧 Supported Vendors',
          value: '• Claude Code\n• Gemini CLI\n• Amp Code\n• Auto-detection',
          inline: true,
        },
        {
          name: '📊 Features',
          value:
            '• Real-time processing\n• Detailed analytics\n• Multiple output formats\n• Error handling',
          inline: true,
        },
      )
      .setFooter({ text: 'Made with agent-stream-fmt library' });

    await interaction.reply({ embeds: [embed] });
  }

  async start() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('🛑 Stopping Discord bot...');
    await this.client.destroy();
    console.log('✅ Bot stopped');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🤖 Agent Stream Formatter Discord Bot');
  console.log('=====================================\n');

  // Validate environment
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN environment variable is required');
    console.error('Set it with: export DISCORD_TOKEN=your_bot_token');
    process.exit(1);
  }

  // Create and start bot
  const bot = new AgentStreamBot();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  // Start the bot
  await bot.start();
}

// Run if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export default AgentStreamBot;
