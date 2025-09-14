let peerConnection = null;
let localStream = null;
let remoteStream = null;

const webcamButton = document.getElementById("webcamButton");
const callButton = document.getElementById("callButton");
const answerButton = document.getElementById("answerButton");
const idInput = document.getElementById("idInput");
const shareButton = document.getElementById("shareButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const socket = io();

// fires when connects to server
socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
});

// fires when disconnects from server
socket.on("disconnect", () => {
    console.log("Disconnected from server");
});

socket.on("room-id", (roomID) => {
    // update UI
    idInput.value = roomID;
    console.log("received roomID:", roomID);
    setupPeerConnectionListener(roomID);
});

// listen for server sending info about call you answered
socket.on("incoming-offer", async (offer) => {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer(offer);
    await peerConnection.setLocalDescription(answer);
    socket.emit("send-answer", answer, idInput.value);
});

socket.on("incoming-answer", async (answer) => {
    await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", (candidate) => {
    peerConnection.addIceCandidate(candidate);
});

// setup webcam button
webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    remoteStream = new MediaStream();

    for (track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
    }

    peerConnection.ontrack = (event) => {
        for (track of event.streams[0].getTracks()) {
            remoteStream.addTrack(track);
        }
    };

    localVideo.srcObject = localStream;
    localVideo.muted = true;

    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
    idInput.disabled = false;
};

// setup call button
callButton.onclick = async () => {
    // disable to avoid changing roomID
    idInput.disabled = true;
    callButton.disabled = true;
    answerButton.disabled = true;
    shareButton.disabled = false;

    // create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("start-call", offer);
};

function answerCall() {
    // disable to avid changing roomID
    idInput.disabled = true;
    callButton.disabled = true;
    answerButton.disabled = true;

    const roomID = idInput.value;
    socket.emit("join-call", roomID);
    console.log("Answered to:", roomID);

    setupPeerConnectionListener(roomID);
}

shareButton.onclick = async () => {
    const shareData = {
        text: idInput.value
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
    } else {
        // fallback to copy
        navigator.clipboard.writeText(idInput.value);
    }
};

async function initPeerConnection() {
    const response = await fetch("/ice-servers.json");
    const stunURLs = await response.json();

    // add "stun:" at the beginning of every stun server
    const iceServers = stunURLs.map(url => ({
        urls: `stun:${url}`
    }));
    peerConnection = new RTCPeerConnection(iceServers);
}

function setupPeerConnectionListener(roomID) {
    // fires when a new ICE candidate is discovered
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE candidate discovered:", event.candidate);
            socket.emit("ice-candidate", event.candidate, idInput.value);
        }
    };
}

initPeerConnection();