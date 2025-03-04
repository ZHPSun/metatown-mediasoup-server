const mediasoup = require("mediasoup"); // 引入 Mediasoup 处理 WebRTC
const socketIo = require("socket.io");
const server = require("http").createServer(); // 创建 HTTP 服务器
const io = socketIo(server, { cors: { origin: "*" } });

let worker, router;

let transports = {};
let producers = {}; // 存储所有的 Producer（推流端）
let consumers = {}; // 存储所有的 Consumer（拉流端）

const getRoomId = (socket) => {
  return [...socket.rooms].filter((room) => room !== socket.id)[0] || null;
};

// 初始化 Mediasoup
(async () => {
  worker = await mediasoup.createWorker({
    logLevel: "debug",
  }); // 创建 Mediasoup Worker 进程
  router = await worker.createRouter({
    // 创建 Router 负责流路由
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
    ],
  });

  console.log("Mediasoup Router created");
})();

// 监听 WebSocket 连接
io.on("connection", async (socket) => {
  console.log(`Client connected: ${socket.id}`);

  transports[socket.id] = {};
  producers[socket.id] = {};
  consumers[socket.id] = {};

  socket.on("join", (roomId, callback) => {
    socket.join(roomId);
    callback();
  });

  socket.on("getRouterRtpCapabilities", (callback) =>
    callback(router.rtpCapabilities)
  );

  socket.on("createTransport", async (callback) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transports[socket.id][transport.id] = transport;
    console.log("createTransport", transport.id);

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

      const roomId = getRoomId(socket);
      io.to(roomId).emit("newProducer", producer.id);

      callback({ id: producer.id });
    }
  );

  socket.on(
    "consume",
    async ({ transportId, producerId, rtpCapabilities }, callback) => {
      console.log("consume", "transportId", transportId);
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

  socket.on("resume", async ({ consumerId }, callback) => {
    await consumers[socket.id][consumerId].resume();
    callback();
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

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

// 启动 WebSocket 服务器
server.listen(3000, () => console.log("Server running on port 3000"));
