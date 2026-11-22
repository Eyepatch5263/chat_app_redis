"use client"

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from "framer-motion"
import { FileText, Image as ImageIcon, Loader, SendHorizonalIcon, ThumbsUpIcon, Video } from 'lucide-react'
import { Textarea } from '../ui/textarea'
import EmojiPicker from './EmojiPicker'
import { Button } from '../ui/button'
import useSound from 'use-sound'
import { usePreferences } from '@/store/usePrefrences'
import { useMutation } from '@tanstack/react-query'
import { deleteUploadedMediaAction, sendMessageAction } from '@/actions/message.actions'
import { useSelectedUser } from '@/store/useSelectedUser'
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from 'next-cloudinary'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { queryClient } from '../Providers/TanStackProvider'
import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs'
import { socket } from "@/lib/socket"
import { Message, MessageType } from '@/types/message'

type MediaDraft = {
  url: string
  publicId: string
  resourceType: 'image' | 'video' | 'raw'
  messageType: Exclude<MessageType, 'text'>
  fileName: string
}

const ChatBottomBar = () => {
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [playSound1] = useSound('/sounds/keystroke1.mp3')
  const [playSound2] = useSound('/sounds/keystroke2.mp3')
  const [playSound3] = useSound('/sounds/keystroke3.mp3')
  const [playSound4] = useSound('/sounds/keystroke4.mp3')
  const [playNotificationSound] = useSound('/sounds/notification.mp3')
  const { user: currentUser } = useKindeBrowserClient()
  const playSoundFunctions = [playSound1, playSound2, playSound3, playSound4]
  const { soundEnabled } = usePreferences()
  const { selectedUser } = useSelectedUser()
  const [mediaDraft, setMediaDraft] = useState<MediaDraft | null>(null)
  const uploadFolder = currentUser?.id ? `chat/${currentUser.id}` : undefined

  const playRandomKeyStroke = () => {
    const randomIndex = Math.floor(Math.random() * playSoundFunctions.length)
    if (soundEnabled) playSoundFunctions[randomIndex]()
  }

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (args: { content: string; messageType: MessageType; receiverId: string }) => {
      const result = await sendMessageAction(args)
      if (!result.success) throw new Error(result.message)
      return result
    },
    onMutate: async (newMessage) => {
      const queryKey = ['messages', newMessage.receiverId]
      await queryClient.cancelQueries({ queryKey })
      const previousMessages = queryClient.getQueryData<Message[]>(queryKey)
      const optimisticMessage: Message = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: newMessage.content,
        messageType: newMessage.messageType,
        senderId: currentUser?.id || '',
        timeStamp: Date.now(),
      }
      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [...old, optimisticMessage])
      return { previousMessages, queryKey }
    },
    onError: (_error, _newMessage, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previousMessages)
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['messages', variables.receiverId] })
    }
  })

  const discardMediaDraft = () => {
    const draft = mediaDraft
    setMediaDraft(null)
    if (!draft) return

    void deleteUploadedMediaAction({
      publicId: draft.publicId,
      resourceType: draft.resourceType,
    }).then((result) => {
      if (!result.success) console.warn('Could not remove the cancelled media upload.')
    }).catch(() => {
      console.warn('Could not remove the cancelled media upload.')
    })
  }

  const queueUploadedMedia = (result: { info?: string | CloudinaryUploadWidgetInfo }, resourceType: MediaDraft['resourceType']) => {
    if (!result.info || typeof result.info === 'string') return
    const info = result.info as CloudinaryUploadWidgetInfo
    if (!info.secure_url || !info.public_id) return
    const messageType: MediaDraft['messageType'] = resourceType === 'raw' ? 'pdf' : resourceType
    setMediaDraft({
      url: info.secure_url,
      publicId: info.public_id,
      resourceType,
      messageType,
      fileName: info.display_name || info.public_id.split('/').pop() || (messageType === 'pdf' ? 'Document.pdf' : 'Attachment'),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      setMessage(`${message}\n`)
    }
  }

  const handleSendMessage = () => {
    if (!message.trim() || !selectedUser?.id) return
    sendMessage({ content: message, messageType: "text", receiverId: selectedUser.id })
    setMessage("")
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (!currentUser?.id || !selectedUser?.id) return

    const conversationId = selectedUser.id
    const channelName = [currentUser.id, conversationId].sort().join('__')
    const queryKey = ['messages', conversationId]

    const joinRoom = () => socket.emit('join', channelName)
    const handleConnect = () => {
      joinRoom()
      // Reconcile anything missed while the socket was offline.
      void queryClient.invalidateQueries({ queryKey })
    }
    const handleNewMessage = (data: { message?: Message }) => {
      const incoming = data?.message
      if (!incoming || incoming.senderId === currentUser.id) return

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
        if (incoming.id && old.some((item) => item.id === incoming.id)) return old
        return [...old, incoming]
      })
      if (soundEnabled) playNotificationSound()
    }

    socket.on('connect', handleConnect)
    socket.on('newMessage', handleNewMessage)
    socket.connect()
    if (socket.connected) handleConnect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('newMessage', handleNewMessage)
      if (socket.connected) socket.emit('leave', channelName)
    }
  }, [currentUser?.id, selectedUser?.id, playNotificationSound, soundEnabled])

  const sendMediaDraft = () => {
    if (!mediaDraft || !selectedUser?.id) return
    sendMessage({
      content: mediaDraft.url,
      messageType: mediaDraft.messageType,
      receiverId: selectedUser.id,
    })
    setMediaDraft(null)
  }

  const uploadOptions = (resourceType: 'image' | 'video' | 'raw', formats: string[]) => ({
    sources: ['local'] as Array<'local'>,
    folder: uploadFolder,
    resourceType,
    clientAllowedFormats: formats,
    multiple: false,
    maxFiles: 1,
    ...(resourceType === 'raw' ? { maxRawFileSize: 20_000_000 } : {}),
  })

  return (
    <>
      <div className='message-composer flex justify-between w-full items-center gap-2'>
        {!message.trim() && currentUser?.id && (
          <>
            <CldUploadWidget
              key="image-upload"
              onSuccess={(result, { widget }) => {
                queueUploadedMedia(result, 'image')
                widget.close()
              }}
              options={uploadOptions('image', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])}
              signatureEndpoint="/api/sign-cloudinary-params">
              {({ open }) => (
                <Button type="button" variant="ghost" size="icon" className="composer-upload-button" aria-label="Upload an image" onClick={() => open()}>
                  <ImageIcon size={22} className='text-muted-foreground' />
                </Button>
              )}
            </CldUploadWidget>
            <CldUploadWidget
              key="video-upload"
              onSuccess={(result, { widget }) => {
                queueUploadedMedia(result, 'video')
                widget.close()
              }}
              options={uploadOptions('video', ['mp4', 'webm', 'mov', 'm4v'])}
              signatureEndpoint="/api/sign-cloudinary-params">
              {({ open }) => (
                <Button type="button" variant="ghost" size="icon" className="composer-upload-button" aria-label="Upload a video" onClick={() => open()}>
                  <Video size={22} className='text-muted-foreground' />
                </Button>
              )}
            </CldUploadWidget>
            <CldUploadWidget
              key="pdf-upload"
              onSuccess={(result, { widget }) => {
                queueUploadedMedia(result, 'raw')
                widget.close()
              }}
              options={uploadOptions('raw', ['pdf'])}
              signatureEndpoint="/api/sign-cloudinary-params">
              {({ open }) => (
                <Button type="button" variant="ghost" size="icon" className="composer-upload-button" aria-label="Upload a PDF" onClick={() => open()}>
                  <FileText size={21} className='text-muted-foreground' />
                </Button>
              )}
            </CldUploadWidget>
          </>
        )}

        <AnimatePresence>
          <motion.div
            key="chat-input"
            layout
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ opacity: { duration: 0.5 }, layout: { type: "spring", bounce: 0.15 } }}
            className='w-full relative'
          >
            <Textarea
              onKeyDown={handleKeyDown}
              ref={inputRef}
              onChange={(e) => {
                setMessage(e.target.value)
                playRandomKeyStroke()
              }}
              value={message}
              autoComplete='off'
              placeholder='Type Your Message'
              rows={1}
              className='w-full border rounded-full items-center h-10 py-2 resize-none overflow-hidden bg-background min-h-0'
            />
            <div className="absolute right-2 bottom-2">
              <EmojiPicker onChange={(emoji) => {
                setMessage((previous) => previous + emoji)
                inputRef.current?.focus()
              }} />
            </div>
          </motion.div>
          {message.trim() ? (
            <Button key='send-button' type="button" onClick={handleSendMessage} disabled={!selectedUser?.id || isPending} className='h-9 w-9 dark:bg-muted dark:text-muted dark:hover:bg-muted dark:hover:text-white shrink-0' variant="ghost" size="icon" aria-label="Send message">
              {isPending ? <Loader size={20} className='animate-spin' /> : <SendHorizonalIcon size={20} />}
            </Button>
          ) : (
            <Button key='thumbs-button' type="button" disabled={!selectedUser?.id || isPending} className='h-9 w-9 dark:bg-muted dark:text-muted dark:hover:bg-muted dark:hover:text-white shrink-0' variant="ghost" size="icon" aria-label="Send a thumbs-up" onClick={() => {
              if (selectedUser?.id) sendMessage({ content: "👍🏻", messageType: "text", receiverId: selectedUser.id })
            }}>
              {isPending ? <Loader size={20} className='animate-spin' /> : <ThumbsUpIcon size={20} />}
            </Button>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={!!mediaDraft} onOpenChange={(open) => { if (!open) discardMediaDraft() }}>
        <DialogContent className="w-[min(92vw,760px)] max-w-none">
          <DialogHeader>
            <DialogTitle>{mediaDraft?.messageType === 'pdf' ? 'PDF preview' : mediaDraft?.messageType === 'video' ? 'Video preview' : 'Image preview'}</DialogTitle>
          </DialogHeader>
          <div className='flex justify-center items-center rounded-lg relative h-[min(60dvh,440px)] min-h-56 w-full mx-auto overflow-hidden bg-muted/30'>
            {mediaDraft?.messageType === 'image' && <img src={mediaDraft.url} alt="Image upload preview" className="max-h-full max-w-full object-contain" />}
            {mediaDraft?.messageType === 'video' && <video src={mediaDraft.url} controls playsInline className="h-full w-full object-contain" />}
            {mediaDraft?.messageType === 'pdf' && <iframe src={mediaDraft.url} title={`PDF preview: ${mediaDraft.fileName}`} className="h-full w-full border-0 bg-white" />}
          </div>
          {mediaDraft?.messageType === 'pdf' && <p className="truncate text-sm text-muted-foreground">{mediaDraft.fileName}</p>}
          <DialogFooter className="flex-row gap-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={discardMediaDraft}>Cancel upload</Button>
            <Button type="button" disabled={!selectedUser?.id || isPending} onClick={sendMediaDraft}>
              {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ChatBottomBar
