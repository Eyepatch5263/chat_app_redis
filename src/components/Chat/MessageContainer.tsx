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
        return () => document.removeEventListener("keydown", handleEsc)
    }, [setSelectedUser])
    return (
        <div className='thread-container'>
            <ChatTopBar />
            <div className='thread-content flex flex-col'>
                <MessageList />
            </div>
            <ChatBottomBar />
        </div>
    )
}

export default MessageContainer
