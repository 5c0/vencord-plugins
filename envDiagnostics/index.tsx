import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

export default definePlugin({
  name: "envDiagnostic",
  description: "Logs internal Vencord modules and Discord client info",

  start() {
    console.log("🚀 [EnvDiagnostic] Plugin started");

    // Discord client and browser info
    console.log("🌐 User Agent:", navigator.userAgent);

    // Find Forms module dynamically
    const Forms = findByPropsLazy("FormText");
    console.log("📦 Forms module found:", !!Forms);

    // Find MessageActions module dynamically
    const MessageActions = findByPropsLazy("sendMessage", "editMessage");
    console.log("📦 MessageActions module found:", !!MessageActions);
    console.log("🔧 MessageActions.sendMessage type:", typeof MessageActions?.sendMessage);

    // Test sendMessage safe call
    if (MessageActions?.sendMessage) {
      try {
        MessageActions.sendMessage("000000000000000000", { content: "Test message from EnvDiagnostic" });
        console.log("✅ sendMessage test call succeeded");
      } catch (error) {
        console.error("❌ sendMessage test call error:", error);
      }
    } else {
      console.warn("⚠ sendMessage function not found");
    }
  },

  stop() {
    console.log("🛑 [EnvDiagnostic] Plugin stopped");
  },

  settingsAboutComponent: () => {
    const Forms = findByPropsLazy("FormText");
    return Forms ? (
      <>
        <Forms.FormText>
          Diagnostic plugin to analyze Vencord environment for messaging compatibility.
        </Forms.FormText>
        <Forms.FormText>Check developer console for diagnostic output after enabling this plugin.</Forms.FormText>
      </>
    ) : (
      <p>Loading...</p>
    );
  },
});
