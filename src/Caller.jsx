import React from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000'); // Replace with your server URL

let peerConnection;

const Caller = () => {
  

  return (
    <div>
      <h2>WebRTC Video Call</h2>
      <video id="localVideo" autoPlay muted playsInline></video>
      <video id="remoteVideo" autoPlay playsInline></video>
      <br />
      <button id="callBtn">Call</button>
      <button id="receiveBtn">Receive Call</button>
      <button id="hangUpBtn">Hang Up</button>
    </div>
  );
};

export default Caller;
