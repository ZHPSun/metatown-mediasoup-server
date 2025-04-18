const mediasoup = require("mediasoup");
const socketIo = require("socket.io");
const http = require("http");
const https = require("https");

let server;

const listener = (_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
};

if (process.env.HTTPS) {
  console.log("Using HTTPS");

  const fs = require("fs");
  const path = require("path");

  const options = {
    key: fs.readFileSync(path.join(process.env.HTTPS, "privkey.pem")),
    cert: fs.readFileSync(path.join(process.env.HTTPS, "fullchain.pem")),
  };

  server = https.createServer(options, listener);
} else {
  console.log("Using HTTP");

  server = http.createServer(listener);
}

const io = socketIo(server, { cors: { origin: "*" } });

let worker, router;

const transports = {};
const producers = {};
const consumers = {};

(async () => {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
    ],
  });

  console.log("Mediasoup Router created");
})();

io.on("connection", async (socket) => {
  console.log(`Client connected: ${socket.id}`);

  transports[socket.id] = {};
  producers[socket.id] = {};
  consumers[socket.id] = {};

  socket.on("getRouterRtpCapabilities", (callback) =>
    callback(router.rtpCapabilities)
  );

  socket.on("createTransport", async (callback) => {
    console.log("createTransport");

    const listenIp = process.env.ANNOUNCED_IP
      ? { ip: "0.0.0.0", announcedIp: process.env.ANNOUNCED_IP }
      : { ip: "127.0.0.1", announcedIp: null };

    const transport = await router.createWebRtcTransport({
      listenIps: [listenIp],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transports[socket.id][transport.id] = transport;

    callback({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  socket.on(
    "connectTransport",
    async ({ transportId, dtlsParameters }, callback) => {
      console.log("connectTransport", transportId);

      await transports[socket.id][transportId].connect({ dtlsParameters });
      callback();
    }
  );

  socket.on(
    "produce",
    async ({ transportId, kind, rtpParameters }, callback) => {
      const producer = await transports[socket.id][transportId].produce({
        kind,
        rtpParameters,
      });

      producers[socket.id][producer.id] = producer;

      callback({ id: producer.id });
    }
  );

  socket.on(
    "consume",
    async ({ transportId, producerId, rtpCapabilities }, callback) => {
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: "Cannot consume" });
      }

      const consumer = await transports[socket.id][transportId].consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });

      consumers[socket.id][consumer.id] = consumer;

      callback({
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    }
  );

  socket.on("resumeConsumer", async ({ consumerId }, callback) => {
    await consumers[socket.id][consumerId].resume();
    callback?.();
  });

  socket.on("pauseConsumer", async ({ consumerId }, callback) => {
    console.log("pauseConsumer", consumerId);

    await consumers[socket.id][consumerId].pause();
    callback?.();
  });

  socket.on("resumeProducer", async ({ producerId }, callback) => {
    await producers[socket.id][producerId].resume();
    callback?.();
  });

  socket.on("pauseProducer", async ({ producerId }, callback) => {
    console.log("pauseProducer", producerId);

    await producers[socket.id][producerId].pause();
    callback?.();
  });

  socket.on("disconnect", () => {
    Object.values(transports[socket.id]).forEach((transport) => {
      transport.close();
    });
    delete transports[socket.id];

    Object.values(producers[socket.id]).forEach((producer) => {
      producer.close();
    });
    delete producers[socket.id];

    Object.values(consumers[socket.id]).forEach((consumer) => {
      consumer.close();
    });
    delete consumers[socket.id];
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("Server running on port 3000")
);
