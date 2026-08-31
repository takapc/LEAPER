import { useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CloseIcon, SearchIcon } from '@chakra-ui/icons'
import { searchEnglishWords } from '../utils/quizLogic'

export function WordSearch({ words, onSelectWord }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const results = searchEnglishWords(words, query)

  const handleSelect = (word) => {
    onSelectWord(word)
    setQuery(word.word)
    setIsOpen(false)
  }

  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
  }

  return (
    <Box position="relative" w="full" maxW="520px" mx="auto" zIndex={2}>
      <FormControl>
        <FormLabel fontSize="sm" mb={1}>英単語を検索</FormLabel>
        <InputGroup>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="例: agree"
            bg="white"
            aria-label="英単語を検索"
            autoComplete="off"
          />
          <InputRightElement>
            {query ? (
              <Button
                onClick={handleClear}
                variant="ghost"
                size="sm"
                aria-label="検索をクリア"
              >
                <CloseIcon boxSize={2.5} />
              </Button>
            ) : (
              <SearchIcon color="gray.400" />
            )}
          </InputRightElement>
        </InputGroup>
      </FormControl>

      {isOpen && query.trim() && (
        <Box
          position="absolute"
          top="full"
          mt={1}
          w="full"
          bg="white"
          borderWidth="1px"
          borderRadius="md"
          boxShadow="lg"
          maxH="320px"
          overflowY="auto"
          role="listbox"
        >
          {results.length > 0 ? (
            <VStack spacing={0} align="stretch">
              {results.map((word) => (
                <Button
                  key={word.id}
                  onClick={() => handleSelect(word)}
                  variant="ghost"
                  borderRadius={0}
                  h="auto"
                  py={3}
                  px={4}
                  justifyContent="space-between"
                  role="option"
                >
                  <Text fontWeight="bold">{word.word}</Text>
                  <Text fontSize="xs" color="gray.500">No. {word.id}</Text>
                </Button>
              ))}
            </VStack>
          ) : (
            <Text p={4} fontSize="sm" color="gray.500">
              一致する英単語がありません
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
