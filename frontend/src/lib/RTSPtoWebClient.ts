// class RTSPtoWebClient {
//   static async setupStream(
//     cameraId: string,
//     videoElement: HTMLVideoElement,
//     onStream: () => void,
//     onError: (error: Error) => void
//   ) {
//     console.log("cameraId", cameraId);
//     try {
//       // Create a new RTCPeerConnection with ICE servers
//       const peerConnection = new RTCPeerConnection({
//         iceServers: [
//           { urls: "stun:stun.l.google.com:19302" },
//           { urls: "stun:stun1.l.google.com:19302" },
//         ],
//       });

//       // Get user media (video and audio)
//       const localStream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true,
//       });

//       localStream
//         .getTracks()
//         .forEach((track) => peerConnection.addTrack(track, localStream));

//       // Handle incoming media streams
//       peerConnection.ontrack = (event) => {
//         videoElement.srcObject = event.streams[0];
//         onStream(); // Notify that the stream setup is complete
//       };

//       // Create an offer and set local description
//       const offer = await peerConnection.createOffer();
//       await peerConnection.setLocalDescription(offer).catch((error) => {
//         console.error("Failed to set local description:", error);
//         onError(error);
//       });

//       console.log("Sent SDP Offer");

//       const sdpOffer = btoa(peerConnection.localDescription?.sdp || ""); // Base64 encode SDP offer

//       const formData = new FormData();
//       formData.append("data", sdpOffer);

//       // Send SDP offer to the server
//       const response = await fetch(
//         `http://127.0.0.1:8083/stream/${cameraId}/channel/0/webrtc`,
//         {
//           method: "POST",
//           body: formData,
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`Stream fetch failed: ${response.statusText}`);
//       }

//       const sdpAnswer = atob(await response.text()); // Base64 decode SDP answer
//       console.log("Received SDP Answer:");

//       // Ensure the SDP answer contains ICE parameters
//       if (
//         !sdpAnswer.includes("a=ice-ufrag") ||
//         !sdpAnswer.includes("a=ice-pwd")
//       ) {
//         throw new Error("SDP answer is missing ICE parameters");
//       }

//       const remoteDescription = new RTCSessionDescription({
//         type: "answer",
//         sdp: sdpAnswer,
//       });

//       // Set remote description and handle connection
//       await peerConnection.setRemoteDescription(remoteDescription);
//     } catch (err) {
//       console.log("Error in RTSPtoWebClient setupStream:", err);

//       if (err instanceof Error) {
//         onError(err);
//       } else {
//         onError(new Error(String(err)));
//       }
//     }
//   }
// }

// export default RTSPtoWebClient;




class RTSPtoWebClient {
  static async setupStream(
    cameraId: string,
    videoElement: HTMLVideoElement,
    onStream: () => void,
    onError: (error: Error) => void
  ) {
    console.log("cameraId", cameraId);
    try {
      // Create a new RTCPeerConnection with ICE servers
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add transceivers for receiving video and audio (receive-only)
      peerConnection.addTransceiver("video", { direction: "recvonly" });
      peerConnection.addTransceiver("audio", { direction: "recvonly" });

      // Track if we've notified about stream
      let streamNotified = false;

      // Handle incoming media streams
      peerConnection.ontrack = async (event) => {
        console.log("Received track:", event.track.kind, event.streams);

        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];

          // Set the stream on video element
          videoElement.srcObject = stream;
          console.log(
            "Stream set on video element, stream tracks:",
            stream.getTracks().map((t) => t.kind)
          );

          // Try to play the video
          const tryPlay = async () => {
            try {
              if (videoElement.readyState >= 2) {
                await videoElement.play();
                console.log("Video element playing");
                if (!streamNotified) {
                  streamNotified = true;
                  onStream();
                }
              } else {
                // Wait for metadata
                videoElement.onloadedmetadata = async () => {
                  try {
                    await videoElement.play();
                    console.log(
                      "Video element playing (after metadata loaded)"
                    );
                    if (!streamNotified) {
                      streamNotified = true;
                      onStream();
                    }
                  } catch (playError) {
                    console.error(
                      "Error playing video after metadata:",
                      playError
                    );
                    if (!streamNotified) {
                      streamNotified = true;
                      onStream(); // Still notify even if play fails
                    }
                  }
                };
              }
            } catch (playError) {
              console.error("Error playing video:", playError);
              if (!streamNotified) {
                streamNotified = true;
                onStream(); // Still notify even if play fails
              }
            }
          };

          // Try to play immediately or wait for metadata
          tryPlay();
        }
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === "failed") {
          onError(new Error("ICE connection failed"));
        } else if (peerConnection.iceConnectionState === "connected") {
          console.log("ICE connection established");
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);
        if (peerConnection.connectionState === "failed") {
          onError(new Error("WebRTC connection failed"));
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("ICE candidate:", event.candidate.candidate);
        } else {
          console.log("ICE candidate gathering complete");
        }
      };

      // Create an offer and set local description
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer).catch((error) => {
        console.error("Failed to set local description:", error);
        onError(error);
      });

      console.log("Sent SDP Offer");

      const sdpOffer = btoa(peerConnection.localDescription?.sdp || ""); // Base64 encode SDP offer

      const formData = new FormData();
      formData.append("data", sdpOffer);

      // Send SDP offer to the server
      const response = await fetch(
        `http://127.0.0.1:8083/stream/${cameraId}/channel/0/webrtc`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Stream fetch failed: ${response.statusText}`);
      }

      const sdpAnswer = atob(await response.text()); // Base64 decode SDP answer
      console.log("Received SDP Answer:");

      // Ensure the SDP answer contains ICE parameters
      if (
        !sdpAnswer.includes("a=ice-ufrag") ||
        !sdpAnswer.includes("a=ice-pwd")
      ) {
        throw new Error("SDP answer is missing ICE parameters");
      }

      const remoteDescription = new RTCSessionDescription({
        type: "answer",
        sdp: sdpAnswer,
      });

      // Set remote description and handle connection
      await peerConnection.setRemoteDescription(remoteDescription);
    } catch (err) {
      console.log("Error in RTSPtoWebClient setupStream:", err);

      if (err instanceof Error) {
        onError(err);
      } else {
        onError(new Error(String(err)));
      }
    }
  }
}

export default RTSPtoWebClient;

