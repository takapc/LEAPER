import { useEffect, useRef, useState } from 'react'
import { Alert, AlertIcon, Badge, Box, Button, Card, CardBody, Container, Heading, HStack, Link, Spinner, Text, VStack, useColorModeValue } from '@chakra-ui/react'
import { advanceSvlSession, levelLabel, loadSvlLevel, SVL_SOURCE } from '../utils/svlData'
import { getTotalQuizCountFromLocalStorage, saveTotalQuizCountToLocalStorage } from '../utils/learningStats'
import { queueGlobalQuizIncrement, queueInitialGlobalQuizCount, syncGlobalQuizCount } from '../utils/globalQuizCount'
import packageJson from '../../package.json'

const emptySession = () => ({ history: [], index: -1, usedIds: [] })

export function SvlQuiz({ level }) {
  const [words, setWords] = useState([])
  const [session, setSession] = useState(emptySession)
  const sessionRef = useRef(session)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const syncTimer = useRef()
  const bg = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')

  const next = (list) => {
    const updated = advanceSvlSession(sessionRef.current, list)
    sessionRef.current = updated
    setSession(updated)
    setRevealed(false)
    if (updated.isNewDraw) {
      const count = getTotalQuizCountFromLocalStorage()
      queueInitialGlobalQuizCount(count)
      saveTotalQuizCountToLocalStorage(count + 1)
      queueGlobalQuizIncrement()
      clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => { syncGlobalQuizCount().catch(() => {}) }, 500)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setWords([])
    sessionRef.current = emptySession()
    setSession(sessionRef.current)
    setRevealed(false)
    loadSvlLevel(level).then((loaded) => {
      if (!active) return
      setWords(loaded)
      next(loaded)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('単語を読み込めませんでした。通信状況を確認して、もう一度お試しください。')
      setLoading(false)
    })
    return () => { active = false }
  }, [level, retry])

  useEffect(() => {
    const sync = () => { syncGlobalQuizCount().catch(() => {}) }
    window.addEventListener('online', sync)
    return () => {
      window.removeEventListener('online', sync)
      clearTimeout(syncTimer.current)
      // Flush on mode changes; failures stay in the durable shared queue.
      sync()
    }
  }, [])

  const word = session.history[session.index]
  return (
    <Box minH="100vh" bg={bg} py={{ base: 6, md: 10 }}>
      <Container maxW="container.md" px={{ base: 4, md: 0 }}>
        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Heading as="h1" size={{ base: 'lg', md: 'xl' }} pr={{ base: 12, md: 16 }} minH="44px">SVL12000 <Badge colorScheme="purple" verticalAlign="middle">ベータ</Badge></Heading>
            <Text mt={2} color="gray.600">{levelLabel(level)}{words.length > 0 ? ` ・ ${words.length.toLocaleString()}語` : ''}</Text>
          </Box>
          {loading ? <VStack role="status" py={12}><Spinner /><Text>{levelLabel(level)}を読み込んでいます…</Text></VStack> : error ? (
            <VStack align="stretch"><Alert status="error"><AlertIcon />{error}</Alert><Button onClick={() => setRetry((value) => value + 1)}>再試行</Button></VStack>
          ) : word ? (
            <>
              <Card bg={cardBg} boxShadow="lg" overflow="hidden">
                <CardBody p={{ base: 3, md: 8 }}>
                  <VStack spacing={{ base: 4, md: 6 }} align="stretch">
                    <Text fontSize={{ base: '3xl', md: '5xl' }} fontWeight="bold" textAlign="center" overflowWrap="anywhere" letterSpacing="wide" lineHeight="1" py={{ base: 2, md: 4 }}>{word.word}</Text>
                    <Box borderTopWidth="1px" borderColor="gray.200" />
                    <Box
                      h={{ base: '140px', md: '200px' }}
                      display="flex"
                      flexDirection="column"
                      cursor="pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={revealed ? '答えを非表示' : '答えを表示'}
                      aria-expanded={revealed}
                      sx={{ WebkitTapHighlightColor: 'transparent' }}
                      _focusVisible={{ outline: '2px solid', outlineColor: 'teal.500', outlineOffset: '2px' }}
                      onClick={() => setRevealed((value) => !value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setRevealed((value) => !value)
                        }
                      }}
                    >
                      {revealed ? (
                        <>
                          <Text fontSize="sm" color="gray.500" mb={2}>意味</Text>
                          <Box flex="1" overflowY="auto">
                            <Text fontSize={{ base: 'md', md: 'lg' }} lineHeight="tall" whiteSpace="pre-line">
                              {word.meaning}
                            </Text>
                          </Box>
                        </>
                      ) : (
                        <Box flex="1" display="flex" alignItems="center" justifyContent="center">
                          <Text color="gray.400" fontSize="lg" textAlign="center">
                            ここをタップして答えを表示
                          </Text>
                        </Box>
                      )}
                    </Box>
                  </VStack>
                </CardBody>
              </Card>
              <HStack spacing={3}>
                <Button flex={1} variant="outline" isDisabled={session.index <= 0} onClick={() => {
                  const updated = { ...sessionRef.current, index: sessionRef.current.index - 1 }
                  sessionRef.current = updated
                  setSession(updated)
                  setRevealed(false)
                }}>前の問題</Button>
                <Button flex={1} colorScheme="teal" onClick={() => next(words)}>次の問題</Button>
              </HStack>
            </>
          ) : null}
          <VStack fontSize="sm" color="gray.500" textAlign="center">
            <Link href={SVL_SOURCE} isExternal>データ出典: kim0051/word-levels-db</Link>
            <Text>LEAPER ver{packageJson.version}</Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  )
}
