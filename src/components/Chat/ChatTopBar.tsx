import { useSelectedUser } from '@/store/useSelectedUser'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { X, Phone, PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, ArrowLeft, Lock } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import useSound from 'use-sound'
import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs'
import { socket } from '@/lib/socket'
import * as DialogPrimitive from "@radix-ui/react-dialog"

const ChatTopBar = () => {
  const { selectedUser, setSelectedUser } = useSelectedUser()
  const { user: currentUser } = useKindeBrowserClient()
  const [playSound] = useSound('/sounds/mouse-click.mp3')

  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle')
  const [callDuration, setCallDuration] = useState('00:00')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoCall, setIsVideoCall] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isRemotePrimary, setIsRemotePrimary] = useState(true)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(null)
  const remoteStreamState = useRef<MediaStream | null>(null) // Internal ref to keep track of remote stream
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localStream = useRef<MediaStream | null>(null)
  const pendingOffer = useRef<any>(null)
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([])

  const handleLocalEndCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop())
      localStream.current = null
    }
    setCallState('idle')
    setIsVideoCall(false)
    setIsMuted(false)
    setIsCameraOff(false)
    setIsRemotePrimary(true)
    pendingOffer.current = null
    setRemoteStream(null)
    setLocalStreamState(null)
    remoteStreamState.current = null
    iceCandidateQueue.current = []
    setFacingMode('user')
  }

  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch (err) {
        console.error('Error checking cameras:', err)
      }
    }
    checkCameras()
  }, [])

  useEffect(() => {
    if (callState !== 'active') {
      setCallDuration('00:00')
      return
    }
    const startTime = Date.now()
    const timer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
      const secs = String(elapsedSeconds % 60).padStart(2, '0')
      setCallDuration(`${mins}:${secs}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [callState])

  const endCall = () => {
    // Notify the other peer
    const targetId = selectedUser?.id || pendingOffer.current?.from;
    if (targetId) {
      socket.emit('signal', {
        to: targetId,
        from: currentUser?.id,
        type: 'end-call'
      })
    }
    handleLocalEndCall();
  }

  useEffect(() => {
    if (!currentUser?.id) return

    // Rejoin the user's private signaling room after every connection.
    const joinSelf = () => socket.emit('join-self', currentUser.id)

    const handleSignal = async ({ from, signal, type }: any) => {
      if (type === 'offer') {
        // Only receive calls from the person we are currently chatting with
        // In a real app you'd want to allow calls from anyone but for implemetation simplicity we are only allowing calls from the person we are currently chatting with

        setCallState('incoming')
        setIsVideoCall(signal.isVideo)
        // Store the signaling data to act on it when user accepts
        // For example - User A has generated a "Session Description" (SDP) and sent it to User B which will be used to create a connection between User A and User B when user B accepts the call
        pendingOffer.current = { from, signal: signal.sdp }
      } else if (type === 'answer' && peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal))
        setCallState('active')
        // Process any queued candidates
        while (iceCandidateQueue.current.length > 0) {
          const candidate = iceCandidateQueue.current.shift()
          if (candidate) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
          }
        }
      } else if (type === 'ice-candidate') {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal))
          } catch (e) {
            console.error('Error adding ice candidate', e)
          }
        } else {
          iceCandidateQueue.current.push(signal)
        }
      } else if (type === 'end-call') {
        handleLocalEndCall();
      }
    }

    socket.on('connect', joinSelf)
    socket.on('signal', handleSignal)
    socket.connect()
    if (socket.connected) joinSelf()
    return () => {
      socket.off('connect', joinSelf)
      socket.off('signal', handleSignal)
    }
  }, [currentUser?.id])

  const setupPeerConnection = async (isVideo: boolean) => {
    // If there's an existing stream, stop it first to release the hardware
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }

    // Initializes the RTCPeerConnection object which manages the entire P2P lifecycle.
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // as soon as the connection is created the browser starts looking for 'candidates' which are the best possible paths to send audio data.

    // an ice canidate is just a potential network address where the remote peer can send data to us.

    // A single browser usually generates several candidates
    // Local Candidate: Your internal IP (e.g., 192.168.1.5). Good if you are both on the same WiFi.
    // Server Reflexive Candidate: Your Public IP (found via the STUN server). Needed to get through your home router.
    // Relay Candidate: A TURN server IP (a backup if direct connection is blocked by a firewall).

    // User A finds a potential "path" (Candidate #1).
    // User A can't send it directly to User B yet because the "P2P pipe" isn't open.
    // So, User A sends it to the Signaling Server (Socket.io).
    // The Signaling Server "Forwards" it to User B.
    // User B tries that path. If it works, the P2P pipe opens!
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && selectedUser?.id) {
        socket.emit('signal', {
          to: selectedUser.id,
          from: currentUser?.id,
          type: 'ice-candidate',
          signal: event.candidate
        })
      }
    }

    // This is the remote audio/video stream that fires when the remote track is added(starts arriving from the other person) to the connection.
    peerConnection.current.ontrack = (event) => {
      remoteStreamState.current = event.streams[0]
      setRemoteStream(event.streams[0])
    }

    try {
      // get the usermedia and starts recording their audio/video
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
      })
      localStream.current = stream
      setLocalStreamState(stream)
    } catch (error: any) {
      console.error('Error accessing media devices:', error)
      if (error.name === 'NotReadableError') {
        alert('Could not start video source. Your camera might be in use by another application or tab.')
      } else {
        alert('Could not access camera/microphone: ' + error.message)
      }
      handleLocalEndCall()
      throw error // Re-throw to stop the call initiation
    }

    // addTrack takes the local tracks and adds them to the connection.
    localStream.current!.getTracks().forEach(track => {
      peerConnection.current?.addTrack(track, localStream.current!)
    })
  }

  const initiateCall = async (video: boolean = false) => {
    if (!selectedUser?.id || callState !== 'idle') return
    setIsVideoCall(video)
    setCallState('calling')

    try {
      await setupPeerConnection(video)
    } catch (e) {
      return
    }

    const offer = await peerConnection.current!.createOffer()
    await peerConnection.current!.setLocalDescription(offer)

    socket.emit('signal', {
      to: selectedUser.id,
      from: currentUser?.id,
      type: 'offer',
      signal: {
        sdp: offer,
        isVideo: video
      }
    })
  }

  const acceptCall = async () => {
    if (!pendingOffer.current || callState === 'active') return
    setCallState('active')

    try {
      await setupPeerConnection(isVideoCall)
    } catch (e) {
      // Error is handled inside setupPeerConnection
      return
    }

    await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(pendingOffer.current.signal))
    // Process any queued candidates
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift()
      if (candidate) {
        await peerConnection.current!.addIceCandidate(new RTCIceCandidate(candidate))
      }
    }
    const answer = await peerConnection.current!.createAnswer()
    await peerConnection.current!.setLocalDescription(answer)

    socket.emit('signal', {
      to: pendingOffer.current.from,
      from: currentUser?.id,
      type: 'answer',
      signal: answer
    })
    pendingOffer.current = null
  }

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleCamera = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setIsCameraOff(!isCameraOff)
    }
  }

  const switchCamera = async () => {
    if (!localStream.current || !isVideoCall) return

    const newFacingMode = facingMode === 'user' ? 'environment' : 'user'

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false
      })

      const newVideoTrack = newStream.getVideoTracks()[0]
      const oldVideoTracks = localStream.current.getVideoTracks()

      if (peerConnection.current) {
        const senders = peerConnection.current.getSenders()
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack)
        }
      }

      // Stop old tracks
      oldVideoTracks.forEach(track => track.stop())

      // Combine existing audio with new video track
      const audioTrack = localStream.current.getAudioTracks()[0]
      const tracks = []
      if (audioTrack) tracks.push(audioTrack)
      tracks.push(newVideoTrack)

      const combinedStream = new MediaStream(tracks)
      localStream.current = combinedStream
      setLocalStreamState(combinedStream)
      setFacingMode(newFacingMode)
    } catch (error) {
      console.error("Error switching camera:", error)
      alert("Could not switch camera. Keep in mind that some browsers require a page refresh to release the camera hardware.")
    }
  }

  return (
    <div className='thread-topbar w-full h-20 flex p-4 justify-between items-center border-b'>
      {/* Hidden video element to keep the remote stream active even when dialog is closed */}
      <video
        ref={(el) => {
          if (el && remoteStream) el.srcObject = remoteStream
        }}
        autoPlay
        playsInline
        className="hidden"
      />

      <button type="button" className="mobile-back icon-button" aria-label="Back to conversations" onClick={() => setSelectedUser(null)}><ArrowLeft size={19}/></button>
      <div className='thread-heading'>
        <Avatar className='flex justify-center items-center h-10 w-10 shrink-0'>
          <AvatarImage src={selectedUser?.image} alt='user_image' className='w-10 h-10 object-cover rounded-full' />
        </Avatar>
        <div className="min-w-0"><div className='thread-title' title={selectedUser?.name || undefined}>{selectedUser?.name}</div><div className='thread-subtitle'>Conversation</div></div>
      </div>

      <div className='call-actions flex gap-4 items-center'>
        <button type="button" className="call-action-button" aria-label="Start video call" onClick={() => initiateCall(true)} disabled={callState !== 'idle'}>
          <Video size={20} />
        </button>
        <button type="button" className="call-action-button" aria-label="Start audio call" onClick={() => initiateCall(false)} disabled={callState !== 'idle'}>
          <Phone size={20} />
        </button>
        <button type="button" className="desktop-close icon-button" aria-label="Close conversation" onClick={() => {
          setSelectedUser(null)
          playSound()
        }}><X size={19} /></button>
      </div>

      <DialogPrimitive.Root open={callState !== 'idle'} onOpenChange={(open) => { if (!open) endCall() }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 w-screen h-[100dvh] max-w-none m-0 p-0 border-0 bg-[#0b141a] text-white flex flex-col justify-between overflow-hidden outline-none select-none"
            style={{ width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: '100dvh' }}
          >
            <DialogPrimitive.Title className="sr-only">Call with {selectedUser?.name}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Active call screen</DialogPrimitive.Description>

            {/* INCOMING CALL SCREEN */}
            {callState === 'incoming' && (
              <div className="relative w-full h-full flex flex-col justify-between items-center py-12 md:py-16 px-6 bg-gradient-to-b from-[#111b21] via-[#0b141a] to-[#111b21]">
                <div className="flex flex-col items-center text-center gap-2 pt-safe pt-6">
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Lock size={12} />
                    <span>End-to-end encrypted</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium tracking-wide uppercase mt-1">
                    {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
                    <span>Incoming {isVideoCall ? 'Video Call' : 'Voice Call'}</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 tracking-tight">
                    {selectedUser?.name}
                  </h1>
                </div>

                <div className="relative my-auto flex items-center justify-center">
                  <div className="absolute w-48 h-48 rounded-full bg-emerald-500/10 animate-ping pointer-events-none" />
                  <div className="absolute w-40 h-40 rounded-full bg-emerald-500/20 animate-pulse pointer-events-none" />
                  <Avatar className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-emerald-500/40 shadow-2xl z-10">
                    <AvatarImage src={selectedUser?.image} className="object-cover" />
                  </Avatar>
                </div>

                <div className="w-full max-w-xs flex items-center justify-around pb-safe pb-8">
                  <button
                    type="button"
                    onClick={endCall}
                    className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-xl">
                      <PhoneOff size={28} />
                    </div>
                    <span className="text-xs text-white/80 font-medium">Decline</span>
                  </button>

                  <button
                    type="button"
                    onClick={acceptCall}
                    className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-xl animate-bounce">
                      <Phone size={28} />
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">Accept</span>
                  </button>
                </div>
              </div>
            )}

            {/* VIDEO CALL SCREEN (CALLING OR ACTIVE) */}
            {isVideoCall && (callState === 'calling' || callState === 'active') && (
              <div className="relative w-full h-full bg-black overflow-hidden flex flex-col justify-between">
                {/* Main Fullscreen Video */}
                {callState === 'active' ? (
                  <div className="absolute inset-0 w-full h-full bg-black">
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = isRemotePrimary ? remoteStream : localStreamState
                      }}
                      autoPlay
                      playsInline
                      muted={!isRemotePrimary}
                      className={`w-full h-full object-cover transition-all duration-300 ${(!isRemotePrimary && facingMode === 'user') ? '-scale-x-100' : ''}`}
                    />
                    {isRemotePrimary && !remoteStream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b141a] text-white">
                        <Avatar className="w-28 h-28 mb-4 border-2 border-white/20 animate-pulse">
                          <AvatarImage src={selectedUser?.image} className="object-cover" />
                        </Avatar>
                        <p className="text-base text-white/80">Connecting video...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-black">
                    <video
                      ref={(el) => {
                        if (el && localStreamState) el.srcObject = localStreamState
                      }}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover opacity-60 ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <Avatar className="w-28 h-28 mb-4 border-2 border-white/20 shadow-2xl animate-pulse">
                        <AvatarImage src={selectedUser?.image} className="object-cover" />
                      </Avatar>
                      <h2 className="text-2xl font-bold text-white drop-shadow">{selectedUser?.name}</h2>
                      <p className="text-sm text-white/80 mt-1 animate-pulse">Calling...</p>
                    </div>
                  </div>
                )}

                {/* Secondary PIP Self-Video */}
                {callState === 'active' && (
                  <button
                    type="button"
                    aria-label="Switch main video view"
                    onClick={() => setIsRemotePrimary(!isRemotePrimary)}
                    className="absolute top-20 right-4 w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 cursor-pointer z-30 transition-transform active:scale-95 bg-black"
                  >
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = isRemotePrimary ? localStreamState : remoteStream
                      }}
                      autoPlay
                      playsInline
                      muted={isRemotePrimary}
                      className={`w-full h-full object-cover ${(isRemotePrimary && facingMode === 'user') ? '-scale-x-100' : ''}`}
                    />
                    <div className="absolute bottom-1 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white/90">
                      {isRemotePrimary ? 'You' : (selectedUser?.name?.split(' ')[0] || 'Peer')}
                    </div>
                  </button>
                )}

                {/* Top Overlay Bar */}
                <div className="relative z-30 pt-safe px-5 pt-4 pb-12 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
                  <div className="flex flex-col">
                    <h2 className="font-semibold text-lg md:text-xl text-white drop-shadow">
                      {selectedUser?.name}
                    </h2>
                    <span className="text-xs text-white/80 drop-shadow">
                      {callState === 'calling' ? 'Calling...' : callDuration}
                    </span>
                  </div>
                  {hasMultipleCameras && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 active:scale-95 transition-all"
                      title="Flip camera"
                    >
                      <RefreshCw size={18} />
                    </button>
                  )}
                </div>

                {/* Bottom WhatsApp-style Floating Dock */}
                <div className="relative z-30 pb-safe pb-8 px-4 flex justify-center pointer-events-auto">
                  <div className="bg-[#1f2c34]/90 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 flex items-center gap-4 md:gap-6 shadow-2xl">
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-95"
                      title="Switch camera"
                    >
                      <RefreshCw size={20} />
                    </button>

                    <button
                      type="button"
                      onClick={toggleCamera}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isCameraOff ? 'bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                      title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isMuted ? 'bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button
                      type="button"
                      onClick={endCall}
                      className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform"
                      title="End call"
                    >
                      <PhoneOff size={24} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIO / VOICE CALL SCREEN (CALLING OR ACTIVE) */}
            {!isVideoCall && (callState === 'calling' || callState === 'active') && (
              <div className="relative w-full h-full flex flex-col justify-between items-center py-12 md:py-16 px-6 bg-gradient-to-b from-[#111b21] via-[#0b141a] to-[#111b21]">
                <div className="flex flex-col items-center text-center gap-1.5 pt-safe pt-6">
                  <div className="flex items-center gap-1 text-xs text-white/60 mb-2">
                    <Lock size={12} />
                    <span>End-to-end encrypted</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                    {selectedUser?.name}
                  </h1>
                  <span className="text-sm text-emerald-400 font-medium">
                    {callState === 'calling' ? 'Calling...' : callDuration}
                  </span>
                </div>

                <div className="relative my-auto flex items-center justify-center">
                  {callState === 'calling' && (
                    <>
                      <div className="absolute w-48 h-48 rounded-full bg-white/5 animate-ping pointer-events-none" />
                      <div className="absolute w-40 h-40 rounded-full bg-white/10 animate-pulse pointer-events-none" />
                    </>
                  )}
                  <Avatar className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-white/10 shadow-2xl ring-8 ring-white/5">
                    <AvatarImage src={selectedUser?.image} className="object-cover" />
                  </Avatar>
                </div>

                <div className="w-full max-w-xs pb-safe pb-8 flex justify-center">
                  <div className="bg-[#1f2c34]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 flex items-center gap-6 shadow-2xl">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isMuted ? 'bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    <button
                      type="button"
                      onClick={endCall}
                      className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform"
                      title="End call"
                    >
                      <PhoneOff size={28} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}

export default ChatTopBar
