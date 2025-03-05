const mediasoup = require("mediasoup");
const socketIo = require("socket.io");
const http = require("http");

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

const io = socketIo(server, { cors: { origin: "*" } });

let worker, router;

const transports = {};
const producers = {};
const consumers = {};

const roomToProducer = {};
const socketToRoom = {};

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

  socket.on("join", (roomId, callback) => {
    socket.join(roomId);

    roomToProducer[roomId] = roomToProducer[roomId] || [];
    socketToRoom[socket.id] = roomId;

    callback();
  });

  socket.on("getRouterRtpCapabilities", (callback) =>
    callback(router.rtpCapabilities)
  );

  socket.on("createTransport", async (callback) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "127.0.0.1", announcedIp: process.env.ANNOUNCED_IP }],
      PortRange: { min: 40000, max: 49999 },
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

      const roomId = socketToRoom[socket.id];

      producers[socket.id][producer.id] = producer;
      roomToProducer[roomId].push(producer.id);
      io.to(roomId).emit("newProducer", producer.id);

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

  socket.on("getProducers", (callback) => {
    const roomId = socketToRoom[socket.id];
    callback(roomToProducer[roomId]);
  });

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

      const roomId = socketToRoom[socket.id];
      roomToProducer[roomId] = roomToProducer[roomId].filter(
        (id) => id !== producer.id
      );

      io.to(roomId).emit("closeProducer", producer.id);
    });
    delete producers[socket.id];

    Object.values(consumers[socket.id]).forEach((consumer) => {
      consumer.close();
    });
    delete consumers[socket.id];
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running on port 3000")
);
