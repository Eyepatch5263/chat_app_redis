import { Heart, ArrowUpRight, LockKeyhole } from 'lucide-react'
import AuthButtons from './AuthButtons'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'

const Page = async () => {
  const { isAuthenticated } = getKindeServerSession()
  if (await isAuthenticated()) return redirect('/')
  return <main className="auth-shell">
    <section className="auth-main">
      <header className="auth-brand"><span className="brand-mark"><Heart size={20} fill="currentColor"/></span><span>chatie<span className="brand-period">.</span></span></header>
      <div className="auth-content">
        <p className="eyebrow">A LITTLE SPACE FOR TWO</p>
        <h1>A little closer,<br/><em>every day.</em></h1>
        <p className="auth-description">A private place for your favorite person. Share the small moments, the long talks and everything in between.</p>
        <AuthButtons />
        <p className="auth-privacy"><LockKeyhole size={14}/> Your conversations stay yours.</p>
      </div>
      <footer className="auth-footer"><span>For the person who feels like home.</span><span>01 — 01</span></footer>
    </section>
    <aside className="auth-aside" aria-label="About Chatie">
      <div className="auth-art"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><div className="art-note"><span className="art-note-icon"><Heart size={18} fill="currentColor"/></span><div><strong>Made for your person.</strong><span>Pick up right where you left off.</span></div><ArrowUpRight size={16}/></div></div>
      <div className="aside-caption"><span>LESS NOISE. MORE US.</span><span>CHT—001</span></div>
    </aside>
  </main>
}
export default Page
