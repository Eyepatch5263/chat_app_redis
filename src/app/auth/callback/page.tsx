"use client"
import { useEffect } from 'react'
import { checkAuthStatus } from '@/actions/auth.actions'
import { useQuery } from '@tanstack/react-query'
import { LoaderPinwheel, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const Page = () => {
    const router = useRouter()
    const { data } = useQuery({
        queryKey: ['authCheck'],
        queryFn: async () => await checkAuthStatus()
    })
    useEffect(() => {
        if (data?.success) {
            router.push('/')
        }
    }, [data, router])
    return (
        <main className="auth-progress" aria-busy="true">
            <div className="auth-progress-card">
                <span className="auth-progress-mark"><MessageCircle size={20}/></span>
                <LoaderPinwheel className="auth-progress-spinner" size={20} />
                <h1 className="auth-progress-title">One moment.</h1>
                <p className="auth-progress-copy">Taking you back to your conversations.</p>
            </div>
        </main>
    )
}

export default Page
