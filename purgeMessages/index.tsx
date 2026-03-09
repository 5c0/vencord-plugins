/*
 * Vencord, a modification for Discord's desktop app
 * 
 * This plugin purges messages from a channel
 */

import { Forms, MessageActions, MessageStore, UserStore } from "@webpack/common";
import { Channel, Message } from "@vencord/discord-types";
import definePlugin from "@utils/types";
import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/commands"; // If exists in Vencord, else implement manually
import React from "react";

// Utility function to find an option value from command args
function findOption(opts: any[], name: string, fallback: any) {
  const option = opts.find(o => o.name === name);
  return option ? option.value : fallback;
}

// Deletes messages authored by the current user in the specified channel
async function deleteMessages(amount: number, channel: Channel, delay: number = 1500): Promise<number> {
  let deleted = 0;
  const userId = UserStore.getCurrentUser().id;
  // Get messages authored by current user, reversed order
  const messages: Message[] = [...MessageStore.getMessages(channel.id)._array]
    .filter((m: Message) => m.author.id === userId)
    .reverse();

  for (const message of messages) {
    MessageActions.deleteMessage(channel.id, message.id);
    amount--;
    deleted++;
    if (amount === 0) break;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return deleted;
}

export default definePlugin({
  name: "purgeMessages",
  description: "Purges messages from a channel",
  authors: [
    {
      name: "nyx",
      id: 0n
    }
  ],
  settingsAboutComponent: () => (
    <Forms.FormText className="plugin-warning">
      We can't guarantee this plugin won't get you warned or banned.
    </Forms.FormText>
  ),
  commands: [
    {
      name: "purge",
      description: "Purge a chosen amount of messages from a channel",
      options: [
        {
          name: "amount",
          description: "How many messages you wish to purge",
          type: ApplicationCommandOptionType.INTEGER,
          required: true
        },
        {
          name: "channel",
          description: "Channel ID you wish to purge from",
          type: ApplicationCommandOptionType.CHANNEL,
          required: false
        },
        {
          name: "delay",
          description: "Delay in between deleting messages (milliseconds)",
          type: ApplicationCommandOptionType.INTEGER,
          required: false
        }
      ],
      inputType: ApplicationCommandInputType.BUILT_IN,
      execute: async (opts, ctx) => {
        const amount: number = findOption(opts, "amount", 0);
        const channel: Channel = findOption(opts, "channel", ctx.channel);
        const delay: number = findOption(opts, "delay", 1500);

        sendBotMessage(ctx.channel.id, {
          content: `> deleting ${amount} messages.`
        });

        deleteMessages(amount, channel, delay).then((deleted: number) => {
          sendBotMessage(ctx.channel.id, {
            content: `> deleted ${deleted} messages`
          });
        });
      }
    }
  ]
});
