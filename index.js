const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const webrtc = require("wrtc");
const os = require("os");

let senderStream;

// Set the view engine to EJS
app.set("view engine", "ejs");
app.set("views", "views");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// render stream page
app.get("/stream", (req, res) => {
  res.render("stream");
});

// render viewer page
app.get("/viewer", (req, res) => {
  res.render("viewer");
});

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

  let localIpAddress = "localhost";
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
  console.log(`- Local: http://localhost:5000/stream`);
  console.log(`- Network: http://${localIpAddress}:5000/stream`);

  console.log(`Url for viewer:`);
  console.log(`- Local: http://localhost:5000/viewer`);
  console.log(`- Network: http://${localIpAddress}:5000/viewer`);
});
