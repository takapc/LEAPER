import { useState, useEffect, useRef } from 'react'
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
  IconButton,
  Switch,
  Progress,
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
import {
  getTotalQuizCountFromLocalStorage,
  saveTotalQuizCountToLocalStorage,
} from './utils/learningStats'
import { DataImporter } from './components/DataImporter'
import { PronounceButton } from './components/PronounceButton'
import { RangeSelector } from './components/RangeSelector'
import { WordSearch } from './components/WordSearch'
import {
  filterWordsBySelectedParts,
  formatMeaning,
  PART_RANGES,
  pickRandomUnusedWord,
} from './utils/quizLogic'

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
  const usedWordIdsRef = useRef(usedWordIds)
  const [totalQuizCount, setTotalQuizCount] = useState(() => getTotalQuizCountFromLocalStorage())
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
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const [autoPlayProgress, setAutoPlayProgress] = useState(0)
  const handleNextRef = useRef(() => {})
  const AUTO_PLAY_MS = 3000
  const AUTO_PLAY_REVEAL_MS = 1500

  const partRanges = PART_RANGES

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
    usedWordIdsRef.current = []
    setUsedWordIds([])
    clearUsedWordIdsFromLocalStorage()
    resetNavigation()
    // Partが選択されている場合は、Partの範囲を再適用
    if (selectedParts.length > 0) {
      const filtered = filterWordsBySelectedParts(importedWords, selectedParts, partRanges)
      setFilteredWords(filtered)
      selectRandomWord(filtered)
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

    // 裏技: 開始2009 / 終了213 で感謝カードを表示
    if (startNum === 2009 && endNum === 213) {
      const thankYouWord = {
        id: 2009213,
        word: 'Thank you for using!',
        meaning: 'ご利用ありがとうございました！',
      }

      setFilteredWords([thankYouWord])
      setIsRangeActive(true)
      setIsCheckedOnlyActive(false)
      setSelectedParts([])
      setError(null)
      setStartRange('2009')
      setEndRange('213')
      resetNavigation()
      showWord(thankYouWord, { addToHistory: true })
      return
    }

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

    const rangeWords = wordList.filter(word => word.id >= minId && word.id <= maxId)
    const filtered = isCheckedOnlyActive ? onlyChecked(rangeWords) : rangeWords

    if (filtered.length === 0) {
      setError(`No. ${minId}～${maxId} の範囲に単語が見つかりませんでした。`)
      return
    }

    setFilteredWords(filtered)
    setIsRangeActive(true)
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

  const getBaseWords = () => {
    if (selectedParts.length > 0) {
      return filterWordsBySelectedParts(words, selectedParts, partRanges)
    }

    const start = Number(startRange)
    const end = Number(endRange)
    if (isRangeActive && start > 0 && end >= start) {
      return words.filter((word) => word.id >= start && word.id <= end)
    }

    return words
  }

  const onlyChecked = (wordList) => wordList.filter((word) => checkedWordIds.includes(word.id))

  const toggleCheckedOnly = () => {
    if (isCheckedOnlyActive) {
      const baseWords = getBaseWords()
      setIsCheckedOnlyActive(false)
      setFilteredWords(baseWords)
      resetNavigation()
      selectRandomWord(baseWords)
      return
    }

    const checkedWords = onlyChecked(getBaseWords())

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
    setIsCheckedOnlyActive(true)
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

    // 選択がなくなった場合はリセット
    if (newSelectedParts.length === 0) {
      resetRange()
      return
    }

    const partWords = filterWordsBySelectedParts(words, newSelectedParts, partRanges)
    const filtered = isCheckedOnlyActive ? onlyChecked(partWords) : partWords
    if (filtered.length === 0) {
      toast({ title: 'この範囲に間違えた問題がありません', status: 'info', duration: 3000, isClosable: true, position: 'top' })
      return
    }
    setSelectedParts(newSelectedParts)
    setFilteredWords(filtered)
    setIsRangeActive(true)
    setStartRange('')
    setEndRange('')
    setError(null)
    resetNavigation()
    selectRandomWord(filtered)
  }

  // 範囲をリセット
  const resetRange = () => {
    setStartRange('')
    setEndRange('')
    setIsRangeActive(false)
    setSelectedParts([])
    const nextWords = isCheckedOnlyActive ? onlyChecked(words) : words
    setFilteredWords(nextWords)
    setError(null)
    resetNavigation()
    selectRandomWord(nextWords)
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
    const nextUnusedWord = pickRandomUnusedWord(wordList, usedWordIdsRef.current)

    // 現在の範囲内の全単語が出題済みの場合
    if (!nextUnusedWord) {
      // すべて出題し切ったので、自動でキャッシュをリセットしてユーザーに通知
      clearUsedWordIdsFromLocalStorage()
      usedWordIdsRef.current = []
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
      const updated = [nextWord.id]
      usedWordIdsRef.current = updated
      setUsedWordIds(updated)
      saveUsedWordIdsToLocalStorage(updated)
      incrementTotalQuizCount()

      return
    }

    // まだ出題されていない単語の中からランダムに選択
    const nextWord = nextUnusedWord

    showWord(nextWord, { addToHistory: true })

    // 出題済みIDをキャッシュに追加してローカルストレージにも保存
    const updated = [...usedWordIdsRef.current, nextWord.id]
    usedWordIdsRef.current = updated
    setUsedWordIds(updated)
    saveUsedWordIdsToLocalStorage(updated)
    incrementTotalQuizCount()
  }

  const incrementTotalQuizCount = () => {
    setTotalQuizCount((count) => {
      const updated = count + 1
      saveTotalQuizCountToLocalStorage(updated)
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

  const handleSearchWordSelect = (word) => {
    setIsAutoPlay(false)
    showWord(word, { addToHistory: true })
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

  // 最新の handleNext を ref に保持（自動再生から参照）
  handleNextRef.current = handleNext

  // 自動再生: 3秒ごとに次のカードへ（2.5秒で答え表示、経過をプログレスバー表示）
  useEffect(() => {
    if (!isAutoPlay) {
      setAutoPlayProgress(0)
      return undefined
    }

    setShowAnswer(false)
    const start = performance.now()
    let rafId
    let revealed = false
    let advanced = false

    const tick = (now) => {
      const elapsed = now - start
      setAutoPlayProgress(Math.min(100, (elapsed / AUTO_PLAY_MS) * 100))

      if (elapsed >= AUTO_PLAY_REVEAL_MS && !revealed) {
        revealed = true
        setShowAnswer(true)
      }

      if (elapsed >= AUTO_PLAY_MS && !advanced) {
        advanced = true
        handleNextRef.current()
        return
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [isAutoPlay, currentWord?.id])

  // 自動再生中は、開始クリック以外の操作で停止
  useEffect(() => {
    if (!isAutoPlay) return undefined

    let armed = false
    const armTimer = setTimeout(() => {
      armed = true
    }, 0)

    const stopAutoPlay = (event) => {
      if (!armed) return
      // 間違えた問題のマーク操作では停止しない
      if (event.target?.closest?.('[data-auto-play-ignore]')) return
      setIsAutoPlay(false)
    }

    document.addEventListener('pointerdown', stopAutoPlay, true)
    document.addEventListener('keydown', stopAutoPlay, true)

    return () => {
      clearTimeout(armTimer)
      document.removeEventListener('pointerdown', stopAutoPlay, true)
      document.removeEventListener('keydown', stopAutoPlay, true)
    }
  }, [isAutoPlay])

  const handleStartAutoPlay = () => {
    // 再生中のクリックは pointerdown 側で停止する（ここでは再開しない）
    if (isAutoPlay) return
    setIsAutoPlay(true)
  }

  // 答えを表示/非表示
  const handleToggleAnswer = () => {
    setShowAnswer(!showAnswer)
  }

  // 出題済みキャッシュをリセット
  const handleResetCache = () => {
    // ローカル状態とローカルストレージの両方をクリア
    usedWordIdsRef.current = []
    setUsedWordIds([])
    clearUsedWordIdsFromLocalStorage()
    resetNavigation()

    // 現在の範囲から改めてランダムに1問出題
    if (filteredWords.length > 0) {
      selectRandomWord(filteredWords)
    }
  }

  // 現在の出題範囲における進捗
  const completedInRange = filteredWords.filter((word) => usedWordIds.includes(word.id)).length
  const totalInRange = filteredWords.length
  const progressPercent = totalInRange > 0 ? (completedInRange / totalInRange) * 100 : 0

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
                    {selectedParts.length > 0 ? (
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
                {isCheckedOnlyActive && <> ・ 間違えた問題のみ</>}
            </Text>
            <Text color="teal.600" fontSize="sm" fontWeight="bold" mt={1}>
              これまでの累計 {totalQuizCount.toLocaleString()}語
            </Text>
            {totalInRange > 0 && (
              <Box mt={3} mx="auto" maxW="280px" w="full">
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="xs" color="gray.500">
                    進捗
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {completedInRange} / {totalInRange}
                  </Text>
                </HStack>
                <Progress
                  value={progressPercent}
                  size="xs"
                  colorScheme="teal"
                  borderRadius="full"
                />
              </Box>
            )}
          </Box>

          <WordSearch words={words} onSelectWord={handleSearchWordSelect} />

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
            <Card bg={cardBg} boxShadow="lg" overflow="hidden">
              {isAutoPlay && (
                <Progress
                  value={autoPlayProgress}
                  size="xs"
                  colorScheme="purple"
                  borderRadius="0"
                  sx={{
                    '& > div': {
                      transition: 'none',
                    },
                  }}
                />
              )}
              <CardBody p={{ base: 3, md: 8 }}>
                <VStack spacing={{ base: 4, md: 6 }} align="stretch">
                  {/* 単語番号 */}
                  <HStack justify="space-between">
                    <IconButton
                      data-auto-play-ignore
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
                      <Flex
                        justify="center"
                        align="center"
                        gap={2}
                        py={{ base: 2, md: 4 }}
                        flexWrap="wrap"
                      >
                        <Text
                          as="span"
                          fontSize={{ base: '3xl', md: '5xl' }}
                          fontWeight="bold"
                          letterSpacing="wide"
                          wordBreak="break-word"
                          textAlign="center"
                          lineHeight="1"
                          display="inline-flex"
                          alignItems="center"
                        >
                          {currentWord.word}
                        </Text>
                        <PronounceButton word={currentWord.word} />
                      </Flex>

                      {/* 区切り線 */}
                      <Box borderTop="1px" borderColor="gray.200" />

                      {/* 意味（答え） */}
                      <Box
                        h={{ base: '140px', md: '200px' }}
                        display="flex"
                        flexDirection="column"
                        cursor="pointer"
                        onClick={handleToggleAnswer}
                      >
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
                          <Box
                            flex="1"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Text color="gray.400" fontSize="lg" textAlign="center">
                              ここをタップして答えを表示
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
                      <Box
                        textAlign="center"
                        py={{ base: 2, md: 4 }}
                        minH={{ base: '60px', md: '80px' }}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        cursor="pointer"
                        onClick={handleToggleAnswer}
                      >
                        {showAnswer ? (
                          <Flex justify="center" align="center" gap={2} flexWrap="wrap">
                            <Text
                              as="span"
                              fontSize={{ base: '3xl', md: '5xl' }}
                              fontWeight="bold"
                              letterSpacing="wide"
                              wordBreak="break-word"
                              textAlign="center"
                              lineHeight="1"
                              display="inline-flex"
                              alignItems="center"
                            >
                              {currentWord.word}
                            </Text>
                            <PronounceButton word={currentWord.word} />
                          </Flex>
                        ) : (
                          <Text color="gray.400" fontSize="lg" textAlign="center">
                            ここをタップして答えを表示
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
          <HStack spacing={3} justify="center" flexWrap="wrap" w="full">
            <Button
              onClick={handleStartAutoPlay}
              colorScheme="purple"
              variant={isAutoPlay ? 'solid' : 'outline'}
              size="md"
              w="calc(50% - 6px)"
              maxW="220px"
            >
              {isAutoPlay ? '自動再生中…' : '自動再生'}
            </Button>
            <Button
              onClick={handleResetCache}
              colorScheme="red"
              variant="outline"
              size="md"
              w="calc(50% - 6px)"
              maxW="220px"
            >
              履歴を削除
            </Button>
          </HStack>
          {isAutoPlay && (
            <Text fontSize="xs" color="purple.500" textAlign="center">
              画面を触ると自動再生を停止します
            </Text>
          )}

          {/* 範囲指定パネル */}
          <RangeSelector
            cardBg={cardBg}
            checkedWordCount={checkedWordIds.length}
            endRange={endRange}
            isRangeActive={isRangeActive}
            isCheckedOnlyActive={isCheckedOnlyActive}
            maxWordId={words.length > 0 ? Math.max(...words.map((word) => word.id)) : 0}
            onApplyRange={() => applyRange()}
            onEndRangeChange={(value) => {
              setEndRange(value)
              setSelectedParts([])
            }}
            onResetRange={resetRange}
            onToggleCheckedOnly={toggleCheckedOnly}
            onStartRangeChange={(value) => {
              setStartRange(value)
              setSelectedParts([])
            }}
            onTogglePart={togglePart}
            partRanges={partRanges}
            selectedParts={selectedParts}
            startRange={startRange}
          />

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
