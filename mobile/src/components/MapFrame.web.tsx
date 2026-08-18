// react-native-webview n'existe pas sur le web : une iframe affiche la même page pour les tests E2E
export default function MapFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Carte communautaire"
      srcDoc={html}
      sandbox="allow-scripts"
      style={{ flex: 1, border: 0, width: "100%" }}
    />
  );
}
