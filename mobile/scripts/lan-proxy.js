#!/usr/bin/env node
// Docker tourne dans WSL2, qui a son propre réseau virtuel : l'API répond sur le
// localhost de Windows mais pas sur son adresse réseau, donc le téléphone ne la
// voit pas. Ce relais TCP la rend joignable sur le réseau local pendant le dev.
const net = require("node:net");

const LISTEN_PORT = Number(process.env.API_PROXY_PORT ?? 8001);
const API_PORT = 8000;

const server = net.createServer((client) => {
  const api = net.connect(API_PORT, "127.0.0.1");
  client.pipe(api).pipe(client);

  const close = () => {
    client.destroy();
    api.destroy();
  };
  client.on("error", close);
  api.on("error", close);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Relais actif : réseau local:${LISTEN_PORT} -> 127.0.0.1:${API_PORT}`);
});
