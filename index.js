const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const webrtc = require("wrtc");
const os = require("os");

let senderStream;

app.use(express.static("client"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/broadcast", async ({ body }, res) => {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.stunprotocol.org",
      },
    ],
  });

  // when the broadcaster sends the stream, handle it and store the sender stream
  peer.ontrack = (e) => {
    senderStream = e.streams[0];
  };

  const desc = new webrtc.RTCSessionDescription(body.sdp);
  await peer.setRemoteDescription(desc);

  // send the response after creating the answer
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  const payload = {
    sdp: peer.localDescription,
  };

  res.json(payload);
});

app.post("/consumer", async ({ body }, res) => {
  if (!senderStream) {
    return res.status(400).json({ error: "No broadcaster stream available." });
  }

  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.stunprotocol.org",
      },
    ],
  });

  const desc = new webrtc.RTCSessionDescription(body.sdp);
  await peer.setRemoteDescription(desc);

  // add the tracks of the broadcaster's stream to the peer connection
  senderStream
    .getTracks()
    .forEach((track) => peer.addTrack(track, senderStream));

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  const payload = {
    sdp: peer.localDescription,
  };

  res.json(payload);
});

app.listen(5000, () => {
  const networkInterfaces = os.networkInterfaces();

  let localIpAddress = "localhost"; // Default fallback
  for (const interfaceName in networkInterfaces) {
    for (const net of networkInterfaces[interfaceName]) {
      if (net.family === "IPv4" && !net.internal) {
        localIpAddress = net.address;
        break;
      }
    }
    if (localIpAddress !== "localhost") break;
  }

  console.log(`Server is running on:`);
  console.log(`- Local: http://localhost:5000`);
  console.log(`- Network: http://${localIpAddress}:5000`);
});
