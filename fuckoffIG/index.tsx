/*
 * Vencord, a Discord client mod
 * 
 * Automatically strips Instagram tracking parameters (igsh) from links.
 */
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Forms, React } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically strip tracking parameters from Instagram links"
    },
    stripAllQueries: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Strip ALL query parameters from Instagram links (not just igsh)"
    }
});

// Regex to match Instagram links with tracking
// Group 1: The base URL up to the post/reel ID
// Handles: /p/, /reel/, /reels/, /tv/, /stories/, /share/
const IG_TRACKING_REGEX = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reels?|tv|stories|share\/[\w-]+)\/[\w-]+)\/?(?:\?igsh=[^&\s]*|&igsh=[^&\s]*)/gi;
const IG_ALL_QUERIES_REGEX = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reels?|tv|stories|share\/[\w-]+)\/[\w-]+)\/?(?:\?[^#\s]*)/gi;

export default definePlugin({
    name: "fuckoffIG",
    description: "Automatically strips tracking parameters (igsh) from Instagram links before sending.",
    authors: [{ name: "u_0", id: 957243996936220672n }],
    settings,

    settingsAboutComponent: () => (
        <Forms.FormText className="plugin-warning">
            This plugin cleans Instagram links to protect your privacy by removing tracking tokens like <code>igsh</code>.
        </Forms.FormText>
    ),

    onBeforeMessageSend(_, msg) {
        if (!settings.store.enabled || !msg.content) return;

        const regex = settings.store.stripAllQueries ? IG_ALL_QUERIES_REGEX : IG_TRACKING_REGEX;
        
        if (regex.test(msg.content)) {
            msg.content = msg.content.replace(regex, "$1");
        }
    }
});
