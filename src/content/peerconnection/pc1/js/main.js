/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var pc2VideoButton = document.getElementById('pc2VideoButton');
var hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
pc2VideoButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
pc2VideoButton.onclick = startPC2Video;
hangupButton.onclick = hangup;

var startTime;
var pc1LocalVideo = document.getElementById('pc1-localVideo');
var pc1RemoteVideo = document.getElementById('pc1-remoteVideo');
var pc2LocalVideo = document.getElementById('pc2-localVideo');
var pc2RemoteVideo = document.getElementById('pc2-remoteVideo');

pc1LocalVideo.addEventListener('loadedmetadata', function() {
  trace('PC1 local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

pc2LocalVideo.addEventListener('loadedmetadata', function() {
  trace('PC2 local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

pc1RemoteVideo.addEventListener('loadedmetadata', function() {
  trace('PC1 remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

pc2RemoteVideo.addEventListener('loadedmetadata', function() {
  trace('PC2 remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

pc1RemoteVideo.onresize = function() {
  trace('PC1 Remote video size changed to ' +
    pc1RemoteVideo.videoWidth + 'x' + pc1RemoteVideo.videoHeight);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

pc2RemoteVideo.onresize = function() {
  trace('PC1 Remote video size changed to ' +
    pc2RemoteVideo.videoWidth + 'x' + pc2RemoteVideo.videoHeight);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

var pc1LocalStream;
var pc2LocalStream;
var pc1;
var pc2;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

function gotPC1Stream(stream) {
  trace('Received pc1 local stream');
  pc1LocalVideo.srcObject = stream;
  pc1LocalStream = stream;
  callButton.disabled = false;
}

function gotPC2Stream(stream) {
  trace('Received pc2 local stream');
  pc2LocalVideo.srcObject = stream;
  pc2LocalStream = stream;
  pc2.addStream(stream);
}


function start() {
  trace('Requesting pc1 local stream');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotPC1Stream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function call() {
  callButton.disabled = true;
  pc2VideoButton.disabled = false;
  hangupButton.disabled = false;
  trace('Starting call');
  startTime = window.performance.now();
  var videoTracks = pc1LocalStream.getVideoTracks();
  var audioTracks = pc1LocalStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  var servers = null;
  pc1 = new RTCPeerConnection(servers);
  trace('Created local peer connection object pc1');
  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, e);
  };
  pc2 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object pc2');
  pc2.onicecandidate = function(e) {
    onIceCandidate(pc2, e);
  };
  pc1.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc1, e);
  };
  pc1.onaddstream = gotPC1RemoteStream;

  pc2.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc2, e);
  };
  pc2.onaddstream = gotPC2RemoteStream;

  pc1.addStream(pc1LocalStream);
  trace('Added local stream to pc1');

  trace('pc1 createOffer start');
  pc1.createOffer(
    offerOptions
  ).then(
    function(desc) {
      onCreateOfferSuccess(desc, pc1);
    },
    onCreateSessionDescriptionError
  );
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc, pc) {
  trace('Offer from ' + getName(pc) + ':\n' + desc.sdp);
  trace(getName(pc) + ' setLocalDescription start');
  pc.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(desc, pc);
    },
    onSetSessionDescriptionError
  );
  trace(getOtherPc(pc) + ' setRemoteDescription start');
  getOtherPc(pc).setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(getOtherPc(pc));
    },
    onSetSessionDescriptionError
  );
  trace(getOtherPc(pc) + ' createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  if (pc == pc1) {
    getOtherPc(pc).createAnswer().then(
      function(desc) {
        onCreateAnswerSuccess(desc, getOtherPc(pc));
      },
      onCreateSessionDescriptionError
    );
  }
}

function onSetLocalSuccess(pc) {
  trace(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  trace(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotPC1RemoteStream(e) {
  pc1RemoteVideo.srcObject = e.stream;
  trace('pc1 received remote stream');
}

function gotPC2RemoteStream(e) {
  pc2RemoteVideo.srcObject = e.stream;
  trace('pc2 received remote stream');
}

function onCreateAnswerSuccess(desc, pc) {
  trace('Answer from ' + pc2 + ':\n' + desc.sdp);
  trace(getName(pc) + ' setLocalDescription start');
  pc.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc);
    },
    onSetSessionDescriptionError
  );
  trace(getOtherPc(pc) + ' setRemoteDescription start');
  getOtherPc(pc).setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(getOtherPc(pc));
    },
    onSetSessionDescriptionError
  );
}

function onIceCandidate(pc, event) {
  getOtherPc(pc).addIceCandidate(event.candidate)
  .then(
    function() {
      onAddIceCandidateSuccess(pc);
    },
    function(err) {
      onAddIceCandidateError(pc, err);
    }
  );
  trace(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
      event.candidate.candidate : '(null)'));
}

function onAddIceCandidateSuccess(pc) {
  trace(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  trace(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
  if (pc) {
    trace(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function startPC2Video() {
  trace('Requesting pc2 local stream');
  pc2VideoButton.disabled = true;
  var pc2VideoConstraint = {
        audio: { 
          deviceId: "8620bb8c0696c2d00a98942c0daf12b9d67f3b2cbe28935ad821546dc35274e4"
        },
        video: {
          deviceId: "d908772b8f452e648580187544209535e73d5e24411f698b5ca8b9e025141db5"
        },
  };
  navigator.mediaDevices.getUserMedia(pc2VideoConstraint)
  .then(gotPC2Stream)
  .then(function() {
      return pc2.createOffer(offerOptions);
  })
  .then(function(desc) {
      onCreateOfferSuccess(desc, pc2);
    },
    onCreateSessionDescriptionError
  )
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function hangup() {
  trace('Ending call');
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  if (pc1LocalStream) {
      pc1LocalStream.getTracks().forEach(function(track) {
          track.stop();
      });
  }
  if (pc2LocalStream) {
      pc2LocalStream.getTracks().forEach(function(track) {
          track.stop();
      });
  }

  hangupButton.disabled = true;
  callButton.disabled = true;
  startButton.disabled = false;
}
