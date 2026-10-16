import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CheckIcon } from '@chakra-ui/icons'
import { PART_OF_SPEECH_LABELS } from '../utils/meanings.js'
import { MEANING_COUNT_TAGS, WORD_TAG_LABELS } from '../utils/quizLogic.js'

export function RangeSelector({
  cardBg,
  checkedWordCount,
  endRange,
  filterError,
  isRangeActive,
  isCheckedOnlyActive,
  maxWordId,
  matchingWordCount,
  onApplyRange,
  onEndRangeChange,
  onResetRange,
  onToggleCheckedOnly,
  onToggleTag,
  onStartRangeChange,
  onTogglePart,
  partRanges,
  selectedTags,
  selectedParts,
  startRange,
}) {
  return (
    <Card bg={cardBg} boxShadow="md">
      <CardBody p={4}>
        <Tabs isLazy colorScheme="blue">
          <TabList aria-label="出題条件">
            <Tab flex={1} minW={0} px={2} whiteSpace="nowrap">Part選択</Tab>
            <Tab flex={1} minW={0} px={2} whiteSpace="nowrap">詳細範囲</Tab>
            <Tab flex={1} minW={0} px={2} whiteSpace="nowrap" gap={2}>
              タグ
              {selectedTags.length > 0 && <Badge colorScheme="blue" borderRadius="full">{selectedTags.length}</Badge>}
            </Tab>
          </TabList>
          {filterError && (
            <Alert status="warning" mt={4} borderRadius="md" fontSize="sm">
              <AlertIcon />
              {filterError}
            </Alert>
          )}
          <TabPanels>
            <TabPanel px={0}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  Partを選択
                </Text>
                <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
                  {Object.entries(partRanges).map(([key, part]) => {
                    const isSelected = selectedParts.includes(key)
                    return (
                      <Button
                        key={key}
                        onClick={() => onTogglePart(key)}
                        colorScheme={isSelected ? 'blue' : 'gray'}
                        variant={isSelected ? 'solid' : 'outline'}
                        size="md"
                        aria-pressed={isSelected}
                      >
                        {part.label}
                      </Button>
                    )
                  })}
                </SimpleGrid>
                {isRangeActive && (
                  <Button onClick={onResetRange} size="sm" variant="outline" width="full">
                    範囲をリセット
                  </Button>
                )}
              </VStack>
            </TabPanel>
            <TabPanel px={0}>
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  出題範囲を指定（No.）
                </Text>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={{ base: 'stretch', md: 'flex-end' }}>
                  <FormControl>
                    <FormLabel htmlFor="range-start" fontSize="xs">開始No.</FormLabel>
                    <NumberInput value={startRange} onChange={onStartRangeChange} min={1} max={maxWordId || 1}>
                      <NumberInputField id="range-start" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <Text textAlign="center">～</Text>
                  <FormControl>
                    <FormLabel htmlFor="range-end" fontSize="xs">終了No.</FormLabel>
                    <NumberInput value={endRange} onChange={onEndRangeChange} min={1} max={maxWordId || 1}>
                      <NumberInputField id="range-end" />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <Box>
                    <HStack spacing={2}>
                      <Button onClick={onApplyRange} colorScheme="blue" isDisabled={!startRange || !endRange}>
                        適用
                      </Button>
                      {isRangeActive && (
                        <Button onClick={onResetRange} variant="outline">
                          リセット
                        </Button>
                      )}
                    </HStack>
                  </Box>
                </Stack>
                {maxWordId > 0 && (
                  <Text fontSize="xs" color="gray.500">
                    利用可能な範囲: No. 1 ～ {maxWordId}
                  </Text>
                )}
              </VStack>
            </TabPanel>
            <TabPanel px={0}>
              <VStack align="stretch" spacing={5}>
                <Box>
                  <Text fontSize="sm" fontWeight="bold">選んだタグをすべて満たす単語を出題</Text>
                  <Text fontSize="xs" color="gray.600" mt={1}>Part・詳細範囲とも組み合わせられます。</Text>
                </Box>
                <Box role="group" aria-labelledby="part-of-speech-tags">
                  <Text id="part-of-speech-tags" fontSize="sm" fontWeight="bold" mb={2}>品詞</Text>
                  <SimpleGrid columns={{ base: 3, sm: 4, md: 5 }} spacing={2}>
                    {Object.entries(PART_OF_SPEECH_LABELS).map(([key, label]) => {
                      const isSelected = selectedTags.includes(key)
                      return (
                        <Button
                          key={key}
                          onClick={() => onToggleTag(key)}
                          colorScheme={isSelected ? 'blue' : 'gray'}
                          variant={isSelected ? 'solid' : 'outline'}
                          size="sm"
                          minH="44px"
                          px={2}
                          leftIcon={isSelected ? <CheckIcon boxSize={3} /> : undefined}
                          aria-pressed={isSelected}
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </SimpleGrid>
                </Box>
                <Box role="group" aria-labelledby="word-feature-tags">
                  <Text id="word-feature-tags" fontSize="sm" fontWeight="bold" mb={2}>単語の特徴</Text>
                  <HStack spacing={2} flexWrap="wrap">
                    {Object.keys(MEANING_COUNT_TAGS).map((key) => {
                      const isSelected = selectedTags.includes(key)
                      return (
                        <Button
                          key={key}
                          onClick={() => onToggleTag(key)}
                          colorScheme={isSelected ? 'blue' : 'gray'}
                          variant={isSelected ? 'solid' : 'outline'}
                          size="sm"
                          minH="44px"
                          leftIcon={isSelected ? <CheckIcon boxSize={3} /> : undefined}
                          aria-pressed={isSelected}
                          aria-describedby="meaning-count-help"
                        >
                          {WORD_TAG_LABELS[key]}
                        </Button>
                      )
                    })}
                  </HStack>
                  <Text id="meaning-count-help" fontSize="xs" color="gray.600" mt={2}>
                    多義語は登録された意味が2つ以上。同じ品詞の意味も数えます。
                  </Text>
                </Box>
                <HStack justify="space-between" p={3} bg="gray.50" borderRadius="md">
                  <Box as="label" htmlFor="checked-only" cursor="pointer">
                    <Text fontSize="sm" fontWeight="bold">間違えた問題のみ</Text>
                    <Text fontSize="xs" color="gray.600">マーク済み {checkedWordCount}問に絞り込みます</Text>
                  </Box>
                  <Switch
                    id="checked-only"
                    colorScheme="red"
                    isChecked={isCheckedOnlyActive}
                    onChange={onToggleCheckedOnly}
                    aria-label="間違えた問題のみの出題を切り替える"
                  />
                </HStack>
                {selectedTags.length > 0 && (
                  <Button onClick={() => onToggleTag()} minH="44px" size="sm" variant="ghost" alignSelf="flex-end">
                    タグを解除
                  </Button>
                )}
              </VStack>
            </TabPanel>
          </TabPanels>
          <Text fontSize="xs" color="gray.600" mt={1} aria-live="polite" aria-atomic="true">
            出題対象 {matchingWordCount.toLocaleString()}語
          </Text>
        </Tabs>
      </CardBody>
    </Card>
  )
}
