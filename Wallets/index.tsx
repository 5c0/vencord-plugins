import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Constants, RestAPI, SnowflakeUtils, showToast, Toasts, Forms } from "@webpack/common";

const settings = definePluginSettings({
  BTC: { type: OptionType.STRING, description: "", default: "" },
  SOL: { type: OptionType.STRING, description: "", default: "" },
  ETH: { type: OptionType.STRING, description: "", default: "" },
  LTC: { type: OptionType.STRING, description: "", default: "" },
  DOGE: { type: OptionType.STRING, description: "", default: "" },
  XRP: { type: OptionType.STRING, description: "", default: "" },
  ADA: { type: OptionType.STRING, description: "", default: "" },
  XMR: { type: OptionType.STRING, description: "", default: "" },
});

const cryptoCommands = ["BTC", "SOL", "ETH", "LTC", "DOGE", "XRP", "ADA", "XMR"];

async function postMessage(channelId: string, content: string) {
  try {
    await RestAPI.post({
      url: Constants.Endpoints.MESSAGES(channelId),
      body: {
        content,
        nonce: SnowflakeUtils.fromTimestamp(Date.now()),
        tts: false,
        flags: 0,
        sticker_ids: [],
        embeds: [],
      }
    });
  } catch {
    showToast("Failed to send wallet address message", Toasts.Type.FAILURE);
  }
}

async function executeCommand(command: string, channelId: string) {
  const address = settings.store[command];
  if (!address || address.trim() === "") {
    // Show a toast instead of sending a user message
    showToast(`Your ${command} address is not set in the Wallets plugin settings.`, Toasts.Type.INFO);
    return;
  }
  await postMessage(channelId, address);
}

export default definePlugin({
  name: "Wallets",
  description: "Save your crypto wallet addresses and send them quickly with slash commands",
  authors: [{ name: "u_0", id: 957243996936220672n }],
  settings,

  commands: cryptoCommands.map((cmd) => ({
    name: cmd.toLowerCase(),
    description: `Send your ${cmd} wallet address`,
    inputType: 0,
    execute: async (_, ctx) => {
      await executeCommand(cmd, ctx.channel.id);
    },
  })),

  settingsAboutComponent: () => (
    <>
      <Forms.FormText>
        Enter your wallet addresses below. Use commands like <code>/btc</code> to quickly share your address.
      </Forms.FormText>
      <Forms.FormText>
        Leaving a field empty disables that crypto command.
      </Forms.FormText>
    </>
  ),
});
