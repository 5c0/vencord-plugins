import { definePluginSettings } from "@api/Settings";
import { ErrorCard } from "@components/ErrorCard";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, React } from "@webpack/common";

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
  authors: [{ name: "lain", id: 939658593026867261n }],  settings,
  start: () => setStreamingStatus(),
  stop: () => setStreamingStatus(true),
  settingsAboutComponent: () => (
    <>
      <ErrorCard className={classes(Margins.top16, Margins.bottom16)} style={{ padding: "1em" }}>
        <Heading className={Margins.bottom8}>Note</Heading>
        <Paragraph>
          Your status will show as streaming with the YouTube/Twitch URL and activity name provided here.
        </Paragraph>
      </ErrorCard>
      <div style={{ marginTop: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: "0.5em" }}>
        <Paragraph>
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
        </Paragraph>
        <Paragraph>
          The activity name will be shown as the streaming status message.
        </Paragraph>
        <Paragraph>
          Your streaming status will be visible to friends and servers as if you were streaming live.
        </Paragraph>
      </div>
    </>
  ),
});
