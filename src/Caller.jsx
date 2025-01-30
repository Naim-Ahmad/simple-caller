import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000'); // Replace with your server URL

let peerConnection;

const Caller = () => {
  const [callStatus, setCallStatus] = useState('idle');
  const [target, setTarget] = useState('');
  const [callerId, setCallerId] = useState('');
  const [peers, setPeers] = useState([]);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const peerConnections = useRef({});
  const peerConnectionRef = useRef(null);



  useEffect(() => {

    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Example STUN server
    });


    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        socket.emit('ice-candidate', { target, candidate: event.candidate });
      }
    };

    socket.on('ice-candidate', (data) => {
      if (data.candidate && peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((e) => console.error("Error adding received ice candidate", e));
      }
    });


    socket.on('connect', () => {
      setCallerId(socket.id);
      console.log(`Connected to socket with ID: ${socket.id}`);
    });

    // Handle incoming call offer
    socket.on('offer', (data) => {
      console.log('Received offer from:', data.target);
      if (window.confirm('Incoming call! Do you want to answer?')) {
        // console.log(data, "getting offer")
        // console.log(data, "convirmed ")
        handleAnswer(data.target, data.offer);
        setCallStatus('in-call');
      }
    });

    socket.on('call-answered', (data) => {
      console.log('Call answered:', data);
      peerConnectionRef.current .setRemoteDescription(new RTCSessionDescription(data.answer)).then(res => {
        console.log("remote description added")
      })
      setCallStatus('in-call');

    });

    socket.on('call-ended', (data) => {
      console.log('Call ended:', data);
      handleCall(data.caller);
    });

    // Clean up when component unmounts
    return () => {
      socket.off('connect');
      socket.off('offer');
      socket.off('call-answered');
      socket.off('call-ended');
    };
  }, []);

  const handleCall = () => {
    console.log('Making a call to:', target);
    setCallStatus('calling');
    socket.emit('call', { target });
    setUpPeerConnection(target);

  };

  const setUpPeerConnection = (peerId) => {
    console.log('Setting up peer connection for:', peerId);
  
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    const peerConnection = peerConnectionRef.current;
  
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };
  
    peerConnection.ontrack = (event) => {
      if (remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId].srcObject = event.streams[0];
      }
    };
  
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      })
      .catch((err) => console.error('Error getting media stream:', err));
  
    peerConnection.createOffer()
      .then((offer) => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        socket.emit('offer', { target: peerId, offer: peerConnection.localDescription });
      })
      .catch((err) => console.error('Error creating offer: ', err));
  };
  

  const handleAnswer = (peerId, offer) => {
    console.log('Answering call from peer:', peerId);
  
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    const peerConnection = peerConnectionRef.current;
  
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };
  
    peerConnection.ontrack = (event) => {
      if (remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId].srcObject = event.streams[0];
      }
    };
  
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      });
  
    peerConnection.createAnswer()
      .then((answer) => {
        return peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        socket.emit('answer', { target: peerId, answer: peerConnection.localDescription });
      })
      .catch((err) => console.error('Error answering call: ', err));
  };
  

  const handleEndCall = () => {
    console.log('Ending call with:', target);
    socket.emit('end-call', { peer: target });
  
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  
    setCallStatus('ended');
    setPeers([]);
  };
  

  const renderVideoElements = () => {
    return peers.map((peerId) => (
      <div key={peerId}>
        <h3>Peer {peerId}</h3>
        <video ref={(ref) => remoteVideoRefs.current[peerId] = ref} autoPlay playsInline />
      </div>
    ));
  };

  return (
    <div>
      <h1>Caller App</h1>
      <video ref={localVideoRef} autoPlay muted playsInline />
      {callStatus === 'idle' && (
        <div>
          <input
            type="text"
            placeholder="Enter target ID"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <button onClick={handleCall}>Call</button>
        </div>
      )}
      {callStatus === 'calling' && <p>Calling...</p>}
      {callStatus === 'in-call' && (
        <div>
          <p>In call with {target}</p>
          <button onClick={handleEndCall}>End Call</button>
        </div>
      )}
      {callStatus === 'ended' && <p>Call Ended</p>}

      {renderVideoElements()}
    </div>
  );
};

export default Caller;
