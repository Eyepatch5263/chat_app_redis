"use client"

import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from "framer-motion"
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Inria_Serif } from 'next/font/google'
import { useSelectedUser } from '@/store/useSelectedUser'
import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs'
import { useQuery } from '@tanstack/react-query'
import { getMessageAction } from '@/actions/message.actions'
import MessageSkeleton from '../skeletons/MessageSkeleton'
import { getReadableTime } from "@/lib/dateTime"

const inria2 = Inria_Serif({
  display: 'swap',
  subsets: ['latin'],
  weight: ["300", "400", "700"]
})

const MessageList = () => {
  const { selectedUser } = useSelectedUser()
  const messageContainerRef = useRef<HTMLDivElement>(null)
  const { user: currentUser, isLoading: isUserLoading } = useKindeBrowserClient()
  const currentUserImage = currentUser?.picture && !currentUser.picture.includes("gravatar")
    ? currentUser.picture
    : undefined

  const { data: messages = [], isLoading: isMessagesLoading } = useQuery({
    queryKey: ['messages', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser || !currentUser) return []
      return await getMessageAction(selectedUser.id, currentUser.id)
    },
    enabled: !!selectedUser && !!currentUser && !isUserLoading,
  })

  useEffect(() => {
    messageContainerRef.current?.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [messages])

  return (
    <div ref={messageContainerRef} className='w-full overflow-y-auto overflow-x-hidden h-full flex flex-col'>
      <AnimatePresence initial={false}>
        {!isMessagesLoading && messages.map((message, index) => {
          const isOwnMessage = message.senderId === currentUser?.id
          const startsGroup = index === 0 || messages[index - 1]?.senderId !== message.senderId
          const avatarImage = isOwnMessage ? currentUserImage : selectedUser?.image
          const avatarFallback = isOwnMessage ? (currentUser?.given_name?.[0] || "M") : (selectedUser?.name?.[0] || "U")

          return (
            <motion.div
              key={message.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ opacity: { duration: 0.12 }, layout: { ease: 'easeOut', type: 'spring', damping: 18, bounce: 0.18 } }}
              className={cn('flex w-full px-4 py-1', isOwnMessage ? 'justify-end' : 'justify-start')}
            >
              <div className="flex min-w-0 max-w-[90%] flex-col md:max-w-[78%] xl:max-w-[70%]">
                <div className={cn('flex min-w-0 items-end gap-2', isOwnMessage && 'flex-row-reverse')}>
                  {startsGroup ? (
                    <Avatar className="h-9 w-9 shrink-0 rounded-full">
                      <AvatarImage src={avatarImage || undefined} alt={isOwnMessage ? "Your profile picture" : `${selectedUser?.name || 'Contact'} profile picture`} className="h-full w-full rounded-full object-cover" />
                      <AvatarFallback>{avatarFallback}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div aria-hidden="true" className="h-9 w-9 shrink-0" />
                  )}

                  <div className="message-bubble min-w-0 max-w-full">
                    {message.messageType === "text" ? (
                      <div className={cn('max-w-full whitespace-pre-wrap break-words rounded-2xl bg-accent px-3 py-2 shadow-sm', inria2.className)}>
                        {message.content}
                      </div>
                    ) : message.messageType === "image" ? (
                      <img src={message.content} alt='Shared image' className='max-h-72 max-w-full rounded-2xl bg-accent/50 object-contain shadow-sm' />
                    ) : message.messageType === "video" ? (
                      <video controls playsInline preload="metadata" className='aspect-video h-auto max-h-72 w-full max-w-sm rounded-2xl bg-black shadow-sm' src={message.content} />
                    ) : message.messageType === "pdf" ? (
                      <div className="w-[min(68vw,420px)] max-w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
                        <iframe src={message.content} title="Shared PDF document" className="h-52 w-full border-0 bg-white" loading="lazy" />
                        <a href={message.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-t px-3 py-2 text-sm text-primary hover:underline">
                          <FileText size={16} aria-hidden="true" />
                          Open or download PDF
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>

                <p className={cn('mt-1 text-[10px] text-muted-foreground', isOwnMessage ? 'mr-11 text-right' : 'ml-11 text-left')}>
                  {getReadableTime(message.timeStamp)}
                </p>
              </div>
            </motion.div>
          )
        })}

        {isMessagesLoading && (
          <div key="loading-skeletons">
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MessageList
