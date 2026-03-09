/*
 * Vencord, a Discord client mod
 * 
 * Follow a friend in voice chat.
 */
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Forms, Menu, React, VoiceStateStore } from "@webpack/common";
import { Channel, User, VoiceState } from "@vencord/discord-types";

// Track info about the user being followed
type FollowedUserInfo = {
    lastChannelId: string;
    userId: string;
} | null;

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

// Stores currently followed user info
let followedUserInfo: FollowedUserInfo = null;

// Lazy find internal Discord modules
const voiceChannelAction = findByPropsLazy("selectVoiceChannel");
const UserStore = findStoreLazy("UserStore");

// Removed RelationshipStore usage since we no longer restrict to friends

// Define plugin settings
const settings = {
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
};

// Context menu patch to add "Follow User" option for any user other than yourself
const UserContextMenuPatch = (children: React.ReactNode[], { user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return;
    const [checked, setChecked] = React.useState(followedUserInfo?.userId === user.id);
    children.push(
        <Menu.MenuSeparator key="separator-follow-voice-user" />,
        <Menu.MenuCheckboxItem
            key="follow-voice-user-checkbox"
            id="fvu-follow-user"
            label="Follow User"
            checked={checked}
            action={() => {
                if (followedUserInfo?.userId === user.id) {
                    followedUserInfo = null;
                    setChecked(false);
                    return;
                }
                followedUserInfo = {
                    lastChannelId: UserStore.getCurrentUser().id,
                    userId: user.id
                };
                setChecked(true);
            }}
        />
    );
};

export default definePlugin({
    name: "followVoiceUser",
    description: "Follow a user in voice chat.",
    authors: [{ name: "u_0", id: 957243996936220672n }],
    settings,
    settingsAboutComponent: () => (
        <Forms.FormText className="plugin-warning">
            This Plugin is used to follow any user into voice chat(s).
        </Forms.FormText>
    ),
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            if (!followedUserInfo) return;
            if (
                settings.onlyWhenInVoice.default &&
                VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id) === null
            ) return;
            voiceStates.forEach(voiceState => {
                if (
                    voiceState.userId === followedUserInfo!.userId &&
                    voiceState.channelId &&
                    voiceState.channelId !== followedUserInfo!.lastChannelId
                ) {
                    followedUserInfo!.lastChannelId = voiceState.channelId;
                    voiceChannelAction.selectVoiceChannel(followedUserInfo!.lastChannelId);
                } else if (
                    voiceState.userId === followedUserInfo!.userId &&
                    !voiceState.channelId &&
                    settings.leaveWhenUserLeaves.default
                ) {
                    voiceChannelAction.selectVoiceChannel(null);
                }
            });
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
