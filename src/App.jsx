import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  Card,
  CardBody,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Flex,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormControl,
  FormLabel,
  IconButton,

  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  Stack,
  Switch,
} from '@chakra-ui/react'
import { useToast } from '@chakra-ui/react'
import { CloseIcon } from '@chakra-ui/icons'
import {
  getLocalWordData,
  getUsedWordIdsFromLocalStorage,
  saveUsedWordIdsToLocalStorage,
  clearUsedWordIdsFromLocalStorage,
  getCheckedWordIdsFromCookie,
  saveCheckedWordIdsToCookie,
  clearCheckedWordIdsFromCookie,
} from './utils/wordData'
import { DataImporter } from './components/DataImporter'

function App() {
  const [words, setWords] = useState([]) // 全単語データ
  const [filteredWords, setFilteredWords] = useState([]) // フィルタリングされた単語データ
  const [currentWord, setCurrentWord] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quizMode, setQuizMode] = useState('en-to-ja') // 'en-to-ja' または 'ja-to-en'
  const [usedWordIds, setUsedWordIds] = useState(() => {
    // 一度出題された単語IDをローカルストレージから復元
    // - 復元に失敗した場合でもアプリが落ちないように空配列を返す
    return getUsedWordIdsFromLocalStorage()
  })
  const [navigation, setNavigation] = useState({ history: [], index: -1 })
  const { history: wordHistory, index: historyIndex } = navigation
  const canGoPrevious = historyIndex > 0
  const toast = useToast() // モダンなトースト通知用
  
  // 範囲指定の状態
  const [startRange, setStartRange] = useState('')
  const [endRange, setEndRange] = useState('')
  const [isRangeActive, setIsRangeActive] = useState(false)
  const [isCheckedOnlyActive, setIsCheckedOnlyActive] = useState(false)
  const [checkedWordIds, setCheckedWordIds] = useState(() => getCheckedWordIdsFromCookie())
  const [selectedParts, setSelectedParts] = useState([]) // ['part1', 'part2', ...] 複数選択可能

  // Partの範囲定義
  const partRanges = {
    part1: { start: 1, end: 400, label: 'Part 1' },
    part2: { start: 401, end: 1000, label: 'Part 2' },
    part3: { start: 1001, end: 1400, label: 'Part 3' },
    part4: { start: 1401, end: null, label: 'Part 4' }, // nullの場合は最大値まで
  }

  // 意味をフォーマット（①、②、③などで改行）
  const formatMeaning = (meaning) => {
    if (!meaning) return ['']
    
    // ①、②、③、④、⑤、⑥、⑦、⑧、⑨、⑩の前で分割
    // 最初の項目の前には改行を入れないようにする
    const parts = meaning.split(/([①②③④⑤⑥⑦⑧⑨⑩])/)
    const lines = []
    let currentLine = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      // 丸数字の場合は新しい行を開始
      if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(part)) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
        }
        currentLine = part
      } else {
        currentLine += part
      }
    }
    
    // 最後の行を追加
    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }
    
    return lines.length > 0 ? lines : [meaning]
  }

  // 背景色とテキスト色の設定
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')

  // 単語データの読み込み
  useEffect(() => {
    loadWordData()
  }, [])

  const loadWordData = async () => {
    setLoading(true)
    setError(null)

    try {
      // CORS の影響を受けないように、ローカルの JSON からデータを読み込む
      const loadedData = getLocalWordData()

      if (loadedData && loadedData.length > 0) {
        setWords(loadedData)
        setFilteredWords(loadedData)
        // 現在のキャッシュ情報に基づいて最初の単語をランダムに選択
        selectRandomWord(loadedData)
      } else {
        setError('単語データを取得できませんでした。')
      }
    } catch (err) {
      console.error('データ読み込みエラー:', err)
      setError('データの読み込みに失敗しました。ローカルJSONを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // データインポート後のコールバック
  const handleDataImported = (importedWords) => {
    setWords(importedWords)
    setError(null)
    setCheckedWordIds([])
    clearCheckedWordIdsFromCookie()
    setIsCheckedOnlyActive(false)
    // データセットが変わったタイミングで出題済みキャッシュをクリア
    // - 古いIDが新しいデータとずれている可能性があるため
    setUsedWordIds([])
    clearUsedWordIdsFromLocalStorage()
    resetNavigation()
    // Partが選択されている場合は、Partの範囲を再適用
    if (selectedParts.length > 0) {
      const maxId = importedWords.length > 0 ? Math.max(...importedWords.map(w => w.id)) : 0
      let minStart = Infinity
      let maxEnd = 0

      selectedParts.forEach(key => {
        const p = partRanges[key]
        if (p.start < minStart) minStart = p.start
        const endNum = p.end === null ? maxId : p.end
        if (endNum > maxEnd) maxEnd = endNum
      })

      applyRange(importedWords, minStart, maxEnd)
    } else if (isRangeActive && startRange && endRange) {
      // 詳細範囲が指定されている場合は、詳細範囲を再適用
      applyRange(importedWords, parseInt(startRange), parseInt(endRange))
    } else {
      setFilteredWords(importedWords)
      selectRandomWord(importedWords)
    }
  }

  // 範囲を適用
  const applyRange = (wordList = words, start = null, end = null) => {
    const startNum = start !== null ? start : parseInt(startRange)
    let endNum = end !== null ? end : parseInt(endRange)
    
    // Part4の場合、endNumがnullの場合は最大値を使用
    if (endNum === null && words.length > 0) {
      endNum = Math.max(...words.map(w => w.id))
    }
    
    if (!startNum || !endNum) {
      return
    }
    
    if (startNum > endNum) {
      setError('開始No.は終了No.以下である必要があります。')
      return
    }
    
    const minId = Math.min(startNum, endNum)
    const maxId = Math.max(startNum, endNum)
    
    const filtered = wordList.filter(word => word.id >= minId && word.id <= maxId)
    
    if (filtered.length === 0) {
      setError(`No. ${minId}～${maxId} の範囲に単語が見つかりませんでした。`)
      return
    }
    
    setFilteredWords(filtered)
    setIsRangeActive(true)
    setIsCheckedOnlyActive(false)
    setError(null)
    setStartRange(minId.toString())
    setEndRange(maxId.toString())
    resetNavigation()
    selectRandomWord(filtered)
  }

  const toggleCurrentWordChecked = () => {
    if (!currentWord) return

    setCheckedWordIds((ids) => {
      const updatedIds = ids.includes(currentWord.id)
        ? ids.filter((id) => id !== currentWord.id)
        : [...ids, currentWord.id]
      saveCheckedWordIdsToCookie(updatedIds)
      return updatedIds
    })
  }

  const selectCheckedWords = () => {
    const checkedWords = words.filter((word) => checkedWordIds.includes(word.id))

    if (checkedWords.length === 0) {
      toast({
        title: '間違えた問題がありません',
        description: '単語カード左上のバツボタンから、出題したい問題を選んでください。',
        status: 'info',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      return
    }

    setFilteredWords(checkedWords)
    setIsRangeActive(true)
    setIsCheckedOnlyActive(true)
    setSelectedParts([])
    setStartRange('')
    setEndRange('')
    setError(null)
    resetNavigation()
    selectRandomWord(checkedWords)
  }

  // Partを選択/解除して範囲を適用
  const togglePart = (partKey) => {
    const part = partRanges[partKey]
    if (!part) return

    let newSelectedParts
    if (selectedParts.includes(partKey)) {
      // 既に選択されている場合は解除
      newSelectedParts = selectedParts.filter(p => p !== partKey)
    } else {
      // 選択されていない場合は追加
      newSelectedParts = [...selectedParts, partKey]
    }

    setSelectedParts(newSelectedParts)

    // 選択がなくなった場合はリセット
    if (newSelectedParts.length === 0) {
      resetRange()
      return
    }

    // 複数のPartの範囲を結合
    const maxId = words.length > 0 ? Math.max(...words.map(w => w.id)) : 0
    let minStart = Infinity
    let maxEnd = 0

    newSelectedParts.forEach(key => {
      const p = partRanges[key]
      if (p.start < minStart) minStart = p.start
      const endNum = p.end === null ? maxId : p.end
      if (endNum > maxEnd) maxEnd = endNum
    })

    // 結合した範囲を適用
    applyRange(words, minStart, maxEnd)
  }

  // 範囲をリセット
  const resetRange = () => {
    setStartRange('')
    setEndRange('')
    setIsRangeActive(false)
    setIsCheckedOnlyActive(false)
    setSelectedParts([])
    setFilteredWords(words)
    setError(null)
    resetNavigation()
    selectRandomWord(words)
  }

  // 出題履歴をリセット
  const resetNavigation = () => {
    setNavigation({ history: [], index: -1 })
  }

  // 単語を表示（必要に応じて履歴にも追加）
  const showWord = (word, { addToHistory = false } = {}) => {
    setCurrentWord(word)
    setShowAnswer(false)

    if (addToHistory) {
      setNavigation(({ history, index }) => {
        const truncated = history.slice(0, index + 1)
        const newHistory = [...truncated, word]
        return { history: newHistory, index: newHistory.length - 1 }
      })
    }
  }

  // ランダムに単語を選択
  const selectRandomWord = (wordList = filteredWords) => {
    if (wordList.length === 0) return

    // 既に出題済みの単語IDを除外したリストを作成
    const availableWords = wordList.filter((word) => !usedWordIds.includes(word.id))

    // 現在の範囲内の全単語が出題済みの場合
    if (availableWords.length === 0) {
      // すべて出題し切ったので、自動でキャッシュをリセットしてユーザーに通知
      clearUsedWordIdsFromLocalStorage()
      setUsedWordIds([])

      toast({
        title: 'すべての単語を出題しました',
        description: '履歴を削除して、同じ範囲から再度出題を開始します。',
        status: 'info',
        duration: 4000,
        isClosable: true,
        position: 'top',
      })

      // リセット後は、その範囲（または全体）から改めてランダムに1問出題
      const randomIndex = Math.floor(Math.random() * wordList.length)
      const nextWord = wordList[randomIndex]

      showWord(nextWord, { addToHistory: true })

      // 新しいキャッシュとして、この単語だけを出題済みとして保存
      setUsedWordIds(() => {
        const updated = [nextWord.id]
        saveUsedWordIdsToLocalStorage(updated)
        return updated
      })

      return
    }

    // まだ出題されていない単語の中からランダムに選択
    const randomIndex = Math.floor(Math.random() * availableWords.length)
    const nextWord = availableWords[randomIndex]

    showWord(nextWord, { addToHistory: true })

    // 出題済みIDをキャッシュに追加してローカルストレージにも保存
    setUsedWordIds((prev) => {
      if (prev.includes(nextWord.id)) {
        return prev
      }
      const updated = [...prev, nextWord.id]
      saveUsedWordIdsToLocalStorage(updated)
      return updated
    })
  }

  // クイズモードを切り替え
  const handleModeChange = (mode) => {
    setQuizMode(mode)
    setShowAnswer(false)
    // モード変更時にも新しい問題を出題
    if (filteredWords.length > 0) {
      selectRandomWord(filteredWords)
    }
  }

  // 前の問題へ
  const handlePrevious = () => {
    if (!canGoPrevious) return

    const newIndex = historyIndex - 1
    setNavigation({ history: wordHistory, index: newIndex })
    setCurrentWord(wordHistory[newIndex])
    setShowAnswer(false)
  }

  // 次の問題へ
  const handleNext = () => {
    if (historyIndex < wordHistory.length - 1) {
      const newIndex = historyIndex + 1
      setNavigation({ history: wordHistory, index: newIndex })
      setCurrentWord(wordHistory[newIndex])
      setShowAnswer(false)
      return
    }

    selectRandomWord(filteredWords)
  }

  // 答えを表示/非表示
  const handleToggleAnswer = () => {
    setShowAnswer(!showAnswer)
  }

  // 出題済みキャッシュをリセット
  const handleResetCache = () => {
    // ローカル状態とローカルストレージの両方をクリア
    setUsedWordIds([])
    clearUsedWordIdsFromLocalStorage()
    resetNavigation()

    // 現在の範囲から改めてランダムに1問出題
    if (filteredWords.length > 0) {
      selectRandomWord(filteredWords)
    }
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor} py={10}>
        <Container maxW="container.md">
          <Flex justify="center" align="center" minH="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" />
              <Text>単語データを読み込んでいます...</Text>
            </VStack>
          </Flex>
        </Container>
      </Box>
    )
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor} py={10}>
        <Container maxW="container.md">
          <VStack spacing={4}>
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
            <HStack spacing={4}>
              <Button onClick={loadWordData} colorScheme="blue">
                再試行
              </Button>
              <DataImporter onDataImported={handleDataImported} />
            </HStack>
          </VStack>
        </Container>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor} py={{ base: 6, md: 10 }}>
      <Container maxW="container.md" px={{ base: 4, md: 0 }}>
        <VStack spacing={6} align="stretch">
          {/* ヘッダー */}
          <Box textAlign="center">
            <Heading as="h1" size="xl" mb={2}>
              LEAP 英単語クイズ
            </Heading>
            <Text color="gray.600" fontSize="sm">
                {isRangeActive ? (
                  <>
                    {isCheckedOnlyActive ? (
                      <>間違えた{filteredWords.length}問から出題</>
                    ) : selectedParts.length > 0 ? (
                      <>
                        {selectedParts.map(key => partRanges[key].label).join(' + ')} ({filteredWords.length}語)
                      </>
                    ) : (
                      <>
                        No. {startRange}～{endRange} ({filteredWords.length}語)
                      </>
                    )}
                  </>
                ) : (
                  <>全{words.length}語からランダムに出題</>
                )}
            </Text>
          </Box>

          {/* クイズモード切り替え */}
          <HStack justify="center" spacing={3} mb={2}>
            <Text fontSize="sm" color={quizMode === 'en-to-ja' ? 'blue.600' : 'gray.500'}>
              英語 → 日本語
            </Text>
            <Switch
              size="lg"
              colorScheme="blue"
              isChecked={quizMode === 'ja-to-en'}
              onChange={(event) => handleModeChange(event.target.checked ? 'ja-to-en' : 'en-to-ja')}
              aria-label="出題方向を切り替える"
            />
            <Text fontSize="sm" color={quizMode === 'ja-to-en' ? 'blue.600' : 'gray.500'}>
              日本語 → 英語
            </Text>
          </HStack>

          {/* 単語カード */}
          {currentWord && (
            <Card bg={cardBg} boxShadow="lg">
              <CardBody p={{ base: 3, md: 8 }}>
                <VStack spacing={{ base: 4, md: 6 }} align="stretch">
                  {/* 単語番号 */}
                  <HStack justify="space-between">
                    <IconButton
                      aria-label={checkedWordIds.includes(currentWord.id) ? '間違えた問題から外す' : 'この問題を間違えた問題に追加'}
                      icon={<CloseIcon />}
                      colorScheme={checkedWordIds.includes(currentWord.id) ? 'red' : 'gray'}
                      variant={checkedWordIds.includes(currentWord.id) ? 'solid' : 'outline'}
                      onClick={toggleCurrentWordChecked}
                    />
                    <Text fontSize="sm" color="gray.500">
                      No. {currentWord.id}
                    </Text>
                  </HStack>

                  {/* 問題部分 */}
                  {quizMode === 'en-to-ja' ? (
                    <>
                      {/* 英単語 */}
                      <Box textAlign="center" py={{ base: 2, md: 4 }}>
                        <Text
                          fontSize={{ base: '2xl', md: '4xl' }}
                          fontWeight="bold"
                          letterSpacing="wide"
                          wordBreak="break-word"
                        >
                          {currentWord.word}
                        </Text>
                      </Box>

                      {/* 区切り線 */}
                      <Box borderTop="1px" borderColor="gray.200" />

                      {/* 意味（答え） */}
                      <Box h={{ base: '140px', md: '200px' }} display="flex" flexDirection="column">
                        {showAnswer ? (
                          <>
                            <Text fontSize="sm" color="gray.500" mb={2}>
                              意味
                            </Text>
                            <Box flex="1" overflowY="auto">
                              <VStack align="stretch" spacing={2}>
                                {formatMeaning(currentWord.meaning).map((line, index) => (
                                  <Text
                                    key={index}
                                    fontSize={{ base: 'md', md: 'lg' }}
                                    lineHeight="tall"
                                  >
                                    {line}
                                  </Text>
                                ))}
                              </VStack>
                            </Box>
                          </>
                        ) : (
                          <Box flex="1" display="flex" alignItems="center" justifyContent="center">
                            <Text color="gray.400" fontSize="lg" textAlign="center">
                              答えを表示するにはボタンをクリック
                            </Text>
                          </Box>
                        )}
                      </Box>
                    </>
                  ) : (
                    <>
                      {/* 意味（問題） */}
                      <Box h={{ base: '140px', md: '200px' }} display="flex" flexDirection="column">
                        <Text fontSize="sm" color="gray.500" mb={2}>
                          意味
                        </Text>
                        <Box flex="1" overflowY="auto">
                          <VStack align="stretch" spacing={2}>
                            {formatMeaning(currentWord.meaning).map((line, index) => (
                              <Text
                                key={index}
                                fontSize={{ base: 'md', md: 'lg' }}
                                lineHeight="tall"
                              >
                                {line}
                              </Text>
                            ))}
                          </VStack>
                        </Box>
                      </Box>

                      {/* 区切り線 */}
                      <Box borderTop="1px" borderColor="gray.200" />

                      {/* 英単語（答え） */}
                      <Box textAlign="center" py={{ base: 2, md: 4 }} minH={{ base: '60px', md: '80px' }} display="flex" alignItems="center" justifyContent="center">
                        {showAnswer ? (
                          <Text
                            fontSize={{ base: '2xl', md: '4xl' }}
                            fontWeight="bold"
                            letterSpacing="wide"
                            wordBreak="break-word"
                          >
                            {currentWord.word}
                          </Text>
                        ) : (
                          <Text color="gray.400" fontSize="lg" textAlign="center">
                            答えを表示するにはボタンをクリック
                          </Text>
                        )}
                      </Box>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* 単語カード直下の問題移動 */}
          <HStack spacing={3} justify="center" w="full">
            <Button
              onClick={handlePrevious}
              colorScheme="gray"
              variant="outline"
              size="md"
              flex="1"
              maxW="220px"
              isDisabled={!canGoPrevious}
            >
              前の問題
            </Button>
            <Button
              onClick={handleNext}
              colorScheme="teal"
              size="md"
              flex="1"
              maxW="220px"
            >
              次の問題
            </Button>
          </HStack>

          {/* 補助操作 */}
          <HStack spacing={3} justify="center" flexWrap="nowrap" w="full">
            <Button
              onClick={handleToggleAnswer}
              colorScheme={showAnswer ? 'gray' : 'blue'}
              size="md"
              flex="1"
              maxW="220px"
            >
              {showAnswer ? '答えを隠す' : '答えを表示'}
            </Button>
            <Button
              onClick={handleResetCache}
              colorScheme="red"
              variant="outline"
              size="md"
              flex="1"
              maxW="220px"
            >
              履歴を削除
            </Button>
          </HStack>

          {/* 範囲指定パネル */}
          <Card bg={cardBg} boxShadow="md">
            <CardBody p={4}>
              <Tabs>
                <TabList>
                  <Tab>Part選択</Tab>
                  <Tab>詳細範囲</Tab>
                  <Tab>間違えた問題</Tab>
                </TabList>

                <TabPanels>
                  {/* Part選択タブ */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">
                        Partを選択
                      </Text>
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                        {Object.entries(partRanges).map(([key, part]) => {
                          const isSelected = selectedParts.includes(key)
                          
                          return (
                            <Button
                              key={key}
                              onClick={() => togglePart(key)}
                              colorScheme={isSelected ? 'blue' : 'gray'}
                              variant={isSelected ? 'solid' : 'outline'}
                              size="md"
                            >
                              {part.label}
                            </Button>
                          )
                        })}
                      </SimpleGrid>
                      {isRangeActive && (
                        <Button
                          onClick={resetRange}
                          colorScheme="gray"
                          size="sm"
                          variant="outline"
                          width="full"
                        >
                          範囲をリセット
                        </Button>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* 詳細範囲タブ */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">
                        出題範囲を指定（No.）
                      </Text>
                      <Stack
                        direction={{ base: 'column', md: 'row' }}
                        spacing={4}
                        align={{ base: 'stretch', md: 'flex-end' }}
                      >
                        <FormControl>
                          <FormLabel fontSize="xs">開始No.</FormLabel>
                          <NumberInput
                            value={startRange}
                            onChange={(value) => {
                              setStartRange(value)
                              setSelectedParts([]) // 詳細範囲を変更したらPart選択を解除
                            }}
                            min={1}
                            max={words.length > 0 ? Math.max(...words.map(w => w.id)) : 1}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        </FormControl>
                        <Text
                          pt={{ base: 0, md: 6 }}
                          textAlign="center"
                        >
                          ～
                        </Text>
                        <FormControl>
                          <FormLabel fontSize="xs">終了No.</FormLabel>
                          <NumberInput
                            value={endRange}
                            onChange={(value) => {
                              setEndRange(value)
                              setSelectedParts([]) // 詳細範囲を変更したらPart選択を解除
                            }}
                            min={1}
                            max={words.length > 0 ? Math.max(...words.map(w => w.id)) : 1}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        </FormControl>
                        <Box pt={{ base: 0, md: 6 }}>
                          <HStack spacing={2}>
                            <Button
                              onClick={() => applyRange()}
                              colorScheme="blue"
                              size="md"
                              isDisabled={!startRange || !endRange}
                            >
                              適用
                            </Button>
                            {isRangeActive && (
                              <Button
                                onClick={resetRange}
                                colorScheme="gray"
                                size="md"
                                variant="outline"
                              >
                                リセット
                              </Button>
                            )}
                          </HStack>
                        </Box>
                      </Stack>
                      {words.length > 0 && (
                        <Text fontSize="xs" color="gray.500">
                          利用可能な範囲: No. 1 ～ {Math.max(...words.map(w => w.id))}
                        </Text>
                      )}
                    </VStack>
                  </TabPanel>
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">
                        間違えた問題だけを出題
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        単語カード左上のバツボタンで選んだ問題を出題します（{checkedWordIds.length}問）。
                      </Text>
                      <Button onClick={selectCheckedWords} colorScheme="green">
                        間違えた問題を出題
                      </Button>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>

          {/* フッター情報 */}
          <VStack spacing={2} textAlign="center" mt={4}>
            <DataImporter onDataImported={handleDataImported} />
            <Text fontSize="xs" color="gray.500">
              データを更新する場合は「データをインポート」からJSONファイルを読み込めます
            </Text>
            <Text fontSize="xs" color="gray.500">
              データ出典: 受かる英語 - LEAP 改訂版 単語一覧
            </Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  )
}

export default App

