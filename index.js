const mediasoup = require("mediasoup"); // 引入 Mediasoup 处理 WebRTC
const socketIo = require("socket.io");
const server = require("http").createServer(); // 创建 HTTP 服务器
const io = socketIo(server, { cors: { origin: "*" } });

let worker, router;

const transports = {};
const producers = {}; // 存储所有的 Producer（推流端）
const consumers = {}; // 存储所有的 Consumer（拉流端）

const roomToProducer = {};
const socketToRoom = {};

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

    roomToProducer[roomId] = roomToProducer[roomId] || [];
    socketToRoom[socket.id] = roomId;

    callback();
  });

  socket.on("getRouterRtpCapabilities", (callback) =>
    callback(router.rtpCapabilities)
  );

  // 创建 Transport, 用于传输数据
  // RecvTransport 用于接收数据
  // SendTransport 用于发送数据
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

  // 连接 Transport
  socket.on(
    "connectTransport",
    async ({ transportId, dtlsParameters }, callback) => {
      console.log("connectTransport", transportId);

      await transports[socket.id][transportId].connect({ dtlsParameters });
      callback();
    }
  );

  // 有客户端推流
  // 通知其他客户端接收推流
  // transportId 用于传输数据
  socket.on(
    "produce",
    async ({ transportId, kind, rtpParameters }, callback) => {
      const producer = await transports[socket.id][transportId].produce({
        kind,
        rtpParameters,
      });
      producers[socket.id][producer.id] = producer;

      const roomId = socketToRoom[socket.id];
      io.to(roomId).emit("newProducer", producer.id);

      roomToProducer[roomId].push(producer.id);

      callback({ id: producer.id });
    }
  );

  // 让客户端拉流
  // 拉流需要知道推流端的 id
  // transportId 用于传输数据
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

  // 客户端想要获取当前房间的所有数据
  socket.on("getProducers", (callback) => {
    const roomId = socketToRoom[socket.id];
    callback(roomToProducer[roomId]);
  });

  socket.on("resume", async ({ consumerId }, callback) => {
    await consumers[socket.id][consumerId].resume();
    callback();
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

      // 通知其他客户端关闭 Producer
      io.to(roomId).emit("closeProducer", producer.id);
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
