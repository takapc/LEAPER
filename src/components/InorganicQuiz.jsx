import { useState } from 'react'
import { Box, Button, Card, CardBody, Container, Heading, HStack, Text, VStack, useColorModeValue } from '@chakra-ui/react'
import reactions from '../data/inorganicReactions.json'
import packageJson from '../../package.json'

const POSITION_KEY = 'leaper:inorganic:position'
const subscripts = '₀₁₂₃₄₅₆₇₈₉'

function formatEquation(equation) {
  return equation.replace(/([A-Za-z)\]])(\d+)/g, (_, symbol, digits) =>
    symbol + Array.from(digits, (digit) => subscripts[Number(digit)]).join(''))
}

function restorePosition() {
  try {
    const position = Number(localStorage.getItem(POSITION_KEY))
    if (Number.isInteger(position) && position >= 0 && position < reactions.length) return position
  } catch { /* The quiz works without browser storage. */ }
  return 0
}

export function InorganicQuiz() {
  const [position, setPosition] = useState(restorePosition)
  const [revealed, setRevealed] = useState(false)
  const question = reactions[position]
  const muted = useColorModeValue('gray.600', 'gray.300')
  const answerBg = useColorModeValue('teal.50', 'whiteAlpha.100')
  const answerAccent = useColorModeValue('teal.700', 'teal.200')

  const nextQuestion = () => {
    const next = (position + 1) % reactions.length
    setPosition(next)
    setRevealed(false)
    try { localStorage.setItem(POSITION_KEY, String(next)) } catch { /* Keep the current position in memory. */ }
  }

  return (
    <Box minH="100vh" py={{ base: 6, md: 10 }}>
      <Container maxW="container.sm" px={{ base: 4, md: 6 }}>
        <VStack align="stretch" spacing={4}>
          <Box pr={{ base: 12, md: 0 }}>
            <Text color={answerAccent} fontSize="sm" fontWeight="bold" letterSpacing="wider">LEAPER</Text>
            <Heading as="h1" size="lg" mt={1}>無機化学モード</Heading>
          </Box>
          <Card>
            <CardBody p={{ base: 4, md: 6 }}>
              <Box h={{ base: '10rem', sm: '8rem' }} overflowY="auto" mb={3} aria-live="polite">
                <HStack justify="space-between" flexWrap="wrap" color={muted} fontSize="xs" mb={2}>
                  <Text>反応式100選 No.{question.sourceNo}</Text>
                  <Text>{position + 1} / {reactions.length} 問</Text>
                </HStack>
                <Heading as="h2" fontSize={{ base: 'lg', sm: 'xl' }} lineHeight="short">{question.prompt}</Heading>
                <Text color={muted} fontSize={{ base: 'sm', sm: 'md' }} mt={2}>{question.observation}</Text>
              </Box>
              <Box pos="relative" h={{ base: '12rem', sm: '10rem' }} bg={answerBg} borderRadius="md" mb={4}>
                <Box
                  id="inorganic-equations"
                  aria-live="polite"
                  h="full"
                  overflowY="auto"
                  p={3}
                  visibility={revealed ? 'visible' : 'hidden'}
                >
                  <Text color={muted} fontSize="xs" fontWeight="semibold" minH={8}>反応式</Text>
                  {question.equations.map((equation) => (
                    <Text key={equation} fontSize={{ base: 'sm', sm: 'md' }} fontWeight="bold" overflowWrap="anywhere">{formatEquation(equation)}</Text>
                  ))}
                  {question.explanation && <Text color={muted} fontSize="sm" mt={1}>{question.explanation}</Text>}
                </Box>
                <Button
                  position="absolute"
                  inset={0}
                  w="full"
                  h="full"
                  variant="unstyled"
                  color={answerAccent}
                  fontSize="3xl"
                  aria-label={revealed ? '反応式を隠す' : '反応式を見る'}
                  aria-controls="inorganic-equations"
                  aria-expanded={revealed}
                  onClick={() => setRevealed((value) => !value)}
                  {...(revealed ? {
                    inset: '0 0 auto auto',
                    w: '44px',
                    h: '44px',
                    fontSize: 'sm',
                  } : {})}
                >
                  <Box as="span" aria-hidden="true">{revealed ? '隠す' : '？'}</Box>
                </Button>
              </Box>
              <Button w="full" minH="44px" colorScheme="teal" onClick={nextQuestion}>次の問題</Button>
            </CardBody>
          </Card>
          <Text textAlign="center" color={muted} fontSize="sm">LEAPER ver{packageJson.version}</Text>
        </VStack>
      </Container>
    </Box>
  )
}
