import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://socket-io-1-6v72.onrender.com');
// const socket = io('http://localhost:4000');


const Caller = () => {
  const [target, setTarget] = useState("");
  const [offerData, setOfferData] = useState(null)
  const peerConnectionRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localVideoRef = useRef(null)

  useEffect(() => {

    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "turn:103.161.153.166:3478", username: "username1", credential: "password1" }
      ]
    })

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && peerConnectionRef.current) {
        // console.log("New ICE Candidate:", event.candidate);
        // Signaling server e pathanor function call
        // sendCandidateToRemotePeer(event.candidate);
        socket.emit("ice-candidate", { target, candidate: event.candidate })
      }
    };

    peerConnectionRef.current.ontrack = (event)=> {
      console.log("track event", event.streams)
      const remoteStream = event.streams[0];
      remoteVideoRef.current.srcObject = remoteStream;
    }

    socket.on("connect", () => {
      console.log("Your ID is ", socket.id)
    })

    socket.on("offer", (data) => {
      setOfferData(data)
    })

    socket.on("call-answered", data => {
      // console.log(data, "answer")
      const remoteSDP = new RTCSessionDescription(data?.answer)
      peerConnectionRef.current.setRemoteDescription(remoteSDP).then(() => {
        console.log("added remote description")
      })
    })

    socket.on("ice-candidate", (data) => {
      // console.log("candidate", data)
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
    })
    return () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, [])

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log(stream, "stream")
      localVideoRef.current.srcObject = stream;
      if (stream) {
        console.log("add trackers added")
        stream.getTracks().forEach(track => peerConnectionRef.current.addTrack(track, stream))
      };
    } catch (error) {
      console.log(error.message)
    }
  }

  // create offer - handleCall
  const handleCall = async () => {
    await getMedia()

    const peerConnection = peerConnectionRef.current;

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    socket.emit("offer", { target, offer })
  }

  const handleAnswer = async () => {

    getMedia()
    const peerConnection = peerConnectionRef.current;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData.offer))
    // console.log("offer data0", offerData)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    socket.emit("answer", { target: offerData?.target, answer })
  }

  const handleEndCall = () => {
    const peerConnection = peerConnectionRef.current;

    if (peerConnection) {
        // Stop all tracks of the local media stream
        const localStream = peerConnection.getLocalStreams()[0]; // Get the first (and only) local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop()); // Stop each track (audio/video)
        }

        // Close the peer connection
        peerConnection.close();
        peerConnectionRef.current = null; // Clean up reference

        console.log("Call ended, peer connection closed.");

        // Optionally, disconnect the socket if required
        socket.emit("end-call", { target: offerData?.target });
        console.log("Socket connection ended.");

    } else {
        console.error("Peer connection not found.");
    }
};


  return (
    <main>
      <div className="video-container">
        <div className="video-wrapper">
          <h2>Local Video</h2>
          <video ref={localVideoRef} autoPlay playsInline></video>
        </div>
        <div className="video-wrapper">
          <h2>Remote Video</h2>
          <video ref={remoteVideoRef} autoPlay playsInline>
          </video>
        </div>

      </div>
      <input
        type="text"
        name="target"
        placeholder='Target ID'
        value={target} onChange={(e) => setTarget(e.target.value)}
      />
      <div className="controls">
        <button onClick={handleCall}>Start Call</button>
        <button disabled={!offerData} onClick={handleAnswer}>Receive</button>
        <button disabled={!offerData} onClick={handleEndCall}>End Call</button>
      </div>
    </main>
  );
};

export default Caller;
