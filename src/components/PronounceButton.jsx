import { useEffect, useState } from 'react'
import { IconButton, Tooltip } from '@chakra-ui/react'

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}

function pickSoftEnglishVoice(voices) {
  const softNamePattern =
    /samantha|jenny|aria|zira|karen|moira|susan|natural|neural|google us english|microsoft.*(aria|jenny|zira)/i

  return (
    voices.find((v) => v.lang === 'en-US' && softNamePattern.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en') && softNamePattern.test(v.name)) ||
    voices.find((v) => v.lang === 'en-US' && /female|woman/i.test(v.name)) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  )
}

/**
 * ブラウザの Speech Synthesis API で英単語を読み上げるボタン
 */
export function PronounceButton({ word, size = 'lg' }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [voices, setVoices] = useState([])

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    setIsSupported(supported)
    if (!supported) return

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices())
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  useEffect(() => {
    // 単語が変わったら再生中の読み上げを止める
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [word])

  const handleSpeak = (event) => {
    event.stopPropagation()

    if (!word || !isSupported) return

    const synth = window.speechSynthesis

    // 再生中なら停止
    if (isPlaying || synth.speaking) {
      synth.cancel()
      setIsPlaying(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    // やや遅め・高めにして柔らかい印象に近づける
    utterance.rate = 0.82
    utterance.pitch = 1.45
    utterance.volume = 0.95

    const englishVoice = pickSoftEnglishVoice(voices.length > 0 ? voices : synth.getVoices())
    if (englishVoice) {
      utterance.voice = englishVoice
    }

    utterance.onstart = () => setIsPlaying(true)
    utterance.onend = () => setIsPlaying(false)
    utterance.onerror = () => setIsPlaying(false)

    synth.cancel()
    synth.speak(utterance)
  }

  if (!isSupported) {
    return null
  }

  return (
    <Tooltip label={isPlaying ? '停止' : '発音を聞く'} placement="top" hasArrow>
      <IconButton
        aria-label={isPlaying ? '発音を停止' : '発音を再生'}
        icon={<SpeakerIcon />}
        onClick={handleSpeak}
        size={size}
        variant="outline"
        colorScheme={isPlaying ? 'teal' : 'gray'}
        borderRadius="full"
        borderWidth="2px"
        w={{ base: '44px', md: '52px' }}
        h={{ base: '44px', md: '52px' }}
        minW={{ base: '44px', md: '52px' }}
        fontSize={{ base: 'xl', md: '2xl' }}
        flexShrink={0}
        alignSelf="center"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        lineHeight="1"
      />
    </Tooltip>
  )
}
