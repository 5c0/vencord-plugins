import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { FluxDispatcher, Forms, React } from "@webpack/common";
import { classes } from "@utils/misc";
import { Margins } from "@utils/margins";
import { ErrorCard } from "@components/ErrorCard";

enum ActivityType {
  STREAMING = 1,
}

const DEFAULT_YOUTUBE_TWITCH_URL = "https://www.youtube.com/watch?v=Gqk7DocjQ3w";
const DEFAULT_ACTIVITY_NAME = "\u200b"; // zero-width space

const settings = definePluginSettings({
  youtubeTwitchUrl: {
    type: OptionType.STRING,
    description: "YouTube/Twitch streaming URL",
    default: DEFAULT_YOUTUBE_TWITCH_URL,
    isValid: (value: string) => {
      if (
        !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|twitch\.tv)\/.+/.test(value)
      ) {
        return "URL must be a valid YouTube or Twitch streaming link.";
      }
      if (value.length > 512) {
        return "URL length must not exceed 512 characters.";
      }
      return true;
    },
  },
  activityName: {
    type: OptionType.STRING,
    description: "Custom activity name",
    default: DEFAULT_ACTIVITY_NAME,
    isValid: (value: string) => {
      if (value.length > 128) {
        return "Activity name must not exceed 128 characters.";
      }
      return true;
    },
  },
});

async function setStreamingStatus(disable?: boolean) {
  const streamingUrl = settings.store.youtubeTwitchUrl;
  const activityName = settings.store.activityName || DEFAULT_ACTIVITY_NAME;

  const activity = disable
    ? null
    : {
        name: activityName,
        type: ActivityType.STREAMING,
        url: streamingUrl,
        application_id: "0", // No app ID needed for standard streaming
        flags: 1 << 0,
      };

  FluxDispatcher.dispatch({
    type: "LOCAL_ACTIVITY_UPDATE",
    activity,
    socketId: "Streamcord",
  });
}

export default definePlugin({
  name: "Streamcord",
  description: "Set your Discord status as streaming with a custom YouTube/Twitch URL and activity name",
  authors: [{ name: "u_0", id: 957243996936220672n }],
  settings,
  start: () => setStreamingStatus(),
  stop: () => setStreamingStatus(true),
  settingsAboutComponent: () => (
    <>
      <ErrorCard className={classes(Margins.top16, Margins.bottom16)} style={{ padding: "1em" }}>
        <Forms.FormTitle>Note</Forms.FormTitle>
        <Forms.FormText>
          Your status will show as streaming with the YouTube/Twitch URL and activity name provided here.
        </Forms.FormText>
      </ErrorCard>
      <div style={{ marginTop: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: "0.5em" }}>
        <Forms.FormText>
          Go to{" "}
          <a
            href="https://www.youtube.com/watch"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--interactive-normal)" }}
          >
            YouTube/Twitch
          </a>{" "}
          to get a valid streaming URL.
        </Forms.FormText>
        <Forms.FormText>
          The activity name will be shown as the streaming status message.
        </Forms.FormText>
        <Forms.FormText>
          Your streaming status will be visible to friends and servers as if you were streaming live.
        </Forms.FormText>
      </div>
    </>
  ),
});
