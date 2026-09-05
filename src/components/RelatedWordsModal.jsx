import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Tag,
  TagLabel,
  Text,
  useColorModeValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { LinkIcon } from '@chakra-ui/icons'
import wordsJson from '../data/words.json'
import { formatHeadwordMeaningForRelatedWord } from '../utils/relatedWordMeanings'

const RELATION_LABELS = {
  'word-family': { label: '語族', colorScheme: 'purple' },
  synonym: { label: '類義語', colorScheme: 'blue' },
  antonym: { label: '対義語', colorScheme: 'orange' },
}

const PART_OF_SPEECH_LABELS = {
  noun: { label: '名詞', colorScheme: 'blue' },
  'transitive-verb': { label: '他動詞', colorScheme: 'red' },
  'intransitive-verb': { label: '自動詞', colorScheme: 'teal' },
  verb: { label: '動詞', colorScheme: 'cyan' },
  adjective: { label: '形容詞', colorScheme: 'green' },
  adverb: { label: '副詞', colorScheme: 'purple' },
  preposition: { label: '前置詞', colorScheme: 'orange' },
  conjunction: { label: '接続詞', colorScheme: 'yellow' },
  auxiliary: { label: '助動詞', colorScheme: 'pink' },
  phrase: { label: '熟語', colorScheme: 'gray' },
}

const bundledMeaningsByWord = new Map(
  wordsJson.map((item) => [
    item.word.trim().toLowerCase(),
    formatHeadwordMeaningForRelatedWord(item.meanings ?? item.meaning),
  ]),
)

function getRelatedWordMeaning(relatedWord) {
  const bundledMeaning = bundledMeaningsByWord.get(relatedWord.word.trim().toLowerCase())
  return bundledMeaning || relatedWord.meaning
}

export function RelatedWordsModal({ word }) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const rowBg = useColorModeValue('gray.50', 'whiteAlpha.100')
  const meaningColor = useColorModeValue('gray.600', 'gray.300')
  const relatedWords = Array.isArray(word?.relatedWords) ? word.relatedWords : []

  if (relatedWords.length === 0) return null

  return (
    <>
      <Button
        onClick={onOpen}
        size="sm"
        variant="ghost"
        colorScheme="purple"
        leftIcon={<LinkIcon />}
        aria-label={`${word.word}の関連語を表示`}
      >
        関連語
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside" isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader pr={12}>
            <Text as="span" fontSize="xl" letterSpacing="wide">
              {word.word}
            </Text>
            <Text as="span" ml={2} fontSize="md" fontWeight="normal" color="gray.500">
              の関連語
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <Divider />

          <ModalBody py={5}>
            <VStack spacing={3} align="stretch">
              {relatedWords.map((relatedWord) => {
                const relation = RELATION_LABELS[relatedWord.type] ?? {
                  label: '関連語',
                  colorScheme: 'gray',
                }
                const partsOfSpeech = Array.isArray(relatedWord.partsOfSpeech)
                  ? relatedWord.partsOfSpeech
                  : []

                return (
                  <Box
                    key={`${relatedWord.type}-${relatedWord.word}`}
                    bg={rowBg}
                    borderRadius="md"
                    px={{ base: 3, md: 4 }}
                    py={3}
                  >
                    <HStack align="start" spacing={3}>
                      <Badge
                        colorScheme={relation.colorScheme}
                        variant="solid"
                        borderRadius="full"
                        fontSize="sm"
                        letterSpacing="wide"
                        mt={1}
                        minW="3.5rem"
                        textAlign="center"
                        px={2.5}
                        py={1}
                      >
                        {relation.label}
                      </Badge>
                      <Box minW={0} flex="1">
                        <HStack spacing={2} rowGap={1} align="center" flexWrap="wrap">
                          <Text fontSize="lg" fontWeight="bold" wordBreak="break-word">
                            {relatedWord.word}
                          </Text>
                          {partsOfSpeech.map((partOfSpeech) => {
                            const part = PART_OF_SPEECH_LABELS[partOfSpeech]
                            if (!part) return null

                            return (
                              <Tag
                                key={partOfSpeech}
                                colorScheme={part.colorScheme}
                                variant="outline"
                                size="sm"
                                fontSize="sm"
                                borderRadius="md"
                                borderLeftWidth="3px"
                                whiteSpace="nowrap"
                              >
                                <TagLabel fontWeight="bold">{part.label}</TagLabel>
                              </Tag>
                            )
                          })}
                        </HStack>
                        <Text mt={1} fontSize="sm" lineHeight="tall" color={meaningColor}>
                          {getRelatedWordMeaning(relatedWord)}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                )
              })}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button onClick={onClose}>閉じる</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
