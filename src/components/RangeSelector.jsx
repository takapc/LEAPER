import {
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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'

export function RangeSelector({
  cardBg,
  checkedWordCount,
  endRange,
  isRangeActive,
  maxWordId,
  onApplyRange,
  onEndRangeChange,
  onResetRange,
  onSelectCheckedWords,
  onStartRangeChange,
  onTogglePart,
  partRanges,
  selectedParts,
  startRange,
}) {
  return (
    <Card bg={cardBg} boxShadow="md">
      <CardBody p={4}>
        <Tabs>
          <TabList>
            <Tab>Part選択</Tab>
            <Tab>詳細範囲</Tab>
            <Tab>間違えた問題</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
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
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  出題範囲を指定（No.）
                </Text>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={{ base: 'stretch', md: 'flex-end' }}>
                  <FormControl>
                    <FormLabel fontSize="xs">開始No.</FormLabel>
                    <NumberInput value={startRange} onChange={onStartRangeChange} min={1} max={maxWordId || 1}>
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <Text textAlign="center">～</Text>
                  <FormControl>
                    <FormLabel fontSize="xs">終了No.</FormLabel>
                    <NumberInput value={endRange} onChange={onEndRangeChange} min={1} max={maxWordId || 1}>
                      <NumberInputField />
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
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  間違えた問題だけを出題
                </Text>
                <Text fontSize="sm" color="gray.500">
                  単語カード左上のバツボタンで選んだ問題を出題します（{checkedWordCount}問）。
                </Text>
                <Button onClick={onSelectCheckedWords} colorScheme="green">
                  間違えた問題を出題
                </Button>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </CardBody>
    </Card>
  )
}
