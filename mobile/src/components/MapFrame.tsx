import { StyleSheet } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

// OpenStreetMap refuse les requêtes sans en-tête Referer : la page doit avoir une origine
const PAGE_ORIGIN = "https://github.com/ManuelDavid69/QRShield";

// La WebView ne sert qu'à afficher la carte : aucun lien ne doit s'y ouvrir
function allowNavigation(request: WebViewNavigation): boolean {
  return request.url.startsWith(PAGE_ORIGIN) || request.url === "about:blank";
}

export default function MapFrame({ html }: { html: string }) {
  return (
    <WebView
      style={styles.map}
      originWhitelist={["https://*", "about:*"]}
      source={{ html, baseUrl: PAGE_ORIGIN }}
      onShouldStartLoadWithRequest={allowNavigation}
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
