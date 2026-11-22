"use client"
import { Button } from './ui/button'
import { Moon, Sun, Volume2, VolumeX, SlidersHorizontal } from "lucide-react"
import { useTheme } from 'next-themes'
import { usePreferences } from '@/store/usePrefrences'
import { useSound } from "use-sound"

const PreferencesTab = () => {
  const { setTheme } = useTheme()
  const { soundEnabled, setSoundEnabled } = usePreferences()
  const [playMouseClick] = useSound("/sounds/mouse-click.mp3")
  const [playSoundOn] = useSound("/sounds/sound-on.mp3", { volume: 0.5 })
  const [playSoundOff] = useSound("/sounds/sound-off.mp3", { volume: 0.5 })
  const toggleSound = () => {
    soundEnabled ? playSoundOff() : playSoundOn()
    setSoundEnabled(!soundEnabled)
  }
  return <details className="preferences-menu">
    <summary className="icon-button preferences-trigger" aria-label="Preferences" title="Preferences"><SlidersHorizontal size={17}/></summary>
    <div className="preferences-panel">
      <p className="preferences-label">APPEARANCE</p>
      <div className="theme-options">
        <Button variant="outline" size="sm" className="preference-option" onClick={() => { soundEnabled && playMouseClick(); setTheme("light") }}><Sun size={15}/> Light</Button>
        <Button variant="outline" size="sm" className="preference-option" onClick={() => { soundEnabled && playMouseClick(); setTheme("dark") }}><Moon size={15}/> Dark</Button>
      </div>
      <div className="preferences-divider"/>
      <button className="sound-option" onClick={toggleSound} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}<span>Interface sounds</span><span className={`sound-state ${soundEnabled ? 'sound-on' : ''}`}>{soundEnabled ? 'On' : 'Off'}</span></button>
    </div>
  </details>
}
export default PreferencesTab
