import React, { useEffect } from 'react'
import ChatTopBar from './ChatTopBar'
import MessageList from './MessageList'
import ChatBottomBar from './ChatBottomBar'
import { useSelectedUser } from '@/store/useSelectedUser'

const MessageContainer = () => {
    const { setSelectedUser } = useSelectedUser()
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedUser(null)
            }
        }
        document.addEventListener("keydown", handleEsc)
        return()=> document.removeEventListener("keydown",handleEsc)
    }, [setSelectedUser])
    return (
        <div className='flex flex-col justify-between w-full h-full'>
            <ChatTopBar />
            <div className='w-full overflow-y-auto overflow-x-hidden h-full flex flex-col'>
                <MessageList />
                <ChatBottomBar />
            </div>
        </div>
    )
}

export default MessageContainer