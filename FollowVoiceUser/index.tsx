/*
 * Vencord, a Discord client mod
 * 
 * Follow a friend in voice chat.
 */
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Forms, Menu, React, VoiceStateStore, UserStore, SelectedChannelStore } from "@webpack/common";
import { Channel, User } from "@vencord/discord-types";

interface VoiceStateChangeEvent {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    sessionId: string;
}

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

// Track info about the user being followed
type FollowedUserInfo = {
    lastChannelId: string;
    userId: string;
} | null;

// Stores currently followed user info
let followedUserInfo: FollowedUserInfo = null;

// Lazy find internal Discord modules
const voiceChannelAction = findByPropsLazy("selectVoiceChannel");

// Define plugin settings
const settings = definePluginSettings({
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only follow the user when you are in a voice channel"
    },
    leaveWhenUserLeaves: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Leave the voice channel when the user leaves (may cause join/leave loops)"
    }
});

// Context menu patch to add "Follow User" option for any user other than yourself
const UserContextMenuPatch = (children: React.ReactNode[], { user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return;
    
    // We use a state to force re-render of the menu item when clicked
    const [followed, setFollowed] = React.useState(followedUserInfo?.userId === user.id);

    children.push(
        <Menu.MenuSeparator key="separator-follow-voice-user" />,
        <Menu.MenuCheckboxItem
            key="follow-voice-user-checkbox"
            id="fvu-follow-user"
            label="Follow User"
            checked={followed}
            action={() => {
                if (followedUserInfo?.userId === user.id) {
                    followedUserInfo = null;
                    setFollowed(false);
                } else {
                    followedUserInfo = {
                        lastChannelId: VoiceStateStore.getVoiceStateForUser(user.id)?.channelId ?? "",
                        userId: user.id
                    };
                    setFollowed(true);
                }
            }}
        />
    );
};

export default definePlugin({
    name: "FollowVoiceUser",
    description: "Follow a user in voice chat.",
    authors: [{ name: "u_0", id: 957243996936220672n }],
    settings,
    settingsAboutComponent: () => (
        <Forms.FormText className="plugin-warning">
            This Plugin is used to follow any user into voice chat(s).
        </Forms.FormText>
    ),
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChangeEvent[] }) {
            if (!followedUserInfo) return;

            const myId = UserStore.getCurrentUser().id;
            
            // If setting enabled, only follow if we are already in voice
            if (settings.store.onlyWhenInVoice && !SelectedChannelStore.getVoiceChannelId()) {
                return;
            }

            for (const state of voiceStates) {
                if (state.userId !== followedUserInfo.userId) continue;

                const { channelId } = state;

                if (channelId && channelId !== followedUserInfo.lastChannelId) {
                    // User moved or joined a new channel
                    followedUserInfo.lastChannelId = channelId;
                    voiceChannelAction.selectVoiceChannel(channelId);
                } else if (!channelId && settings.store.leaveWhenUserLeaves) {
                    // User left voice and we should follow
                    followedUserInfo.lastChannelId = "";
                    voiceChannelAction.selectVoiceChannel(null);
                }
            }
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
