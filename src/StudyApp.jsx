import { useRef, useState } from 'react'
import { Badge, Box, Button, Container, Flex, FormControl, FormLabel, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Radio, RadioGroup, Select, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import App from './App'
import { SvlQuiz } from './components/SvlQuiz'
import { levelLabel, readStudySettings, saveStudySettings, SVL_LEVELS } from './utils/svlData'

export default function StudyApp() {
  const [settings, setSettings] = useState(readStudySettings)
  const [draft, setDraft] = useState(settings)
  const [isOpen, setIsOpen] = useState(false)
  const initialFocusRef = useRef()
  const bg = useColorModeValue('gray.50', 'gray.900')
  return (
    <Box bg={bg}>
      <Container maxW="container.md" px={{ base: 4, md: 0 }} pt={3}>
        <Flex justify="flex-end">
          <Button leftIcon={<SettingsIcon />} variant="ghost" minH="44px" onClick={() => {
            setDraft(settings)
            setIsOpen(true)
          }}>設定</Button>
        </Flex>
      </Container>
      {settings.mode === 'leap' ? <App /> : <SvlQuiz key={settings.level} level={settings.level} />}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} initialFocusRef={initialFocusRef} isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>設定</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <FormControl as="fieldset">
                <FormLabel as="legend">学習モード</FormLabel>
                <RadioGroup value={draft.mode} onChange={(mode) => setDraft((value) => ({ ...value, mode }))}>
                  <Stack spacing={4}>
                    <Radio value="leap" ref={initialFocusRef}>LEAP</Radio>
                    <Radio value="svl"><HStack><Text>SVL12000</Text><Badge colorScheme="purple">ベータ</Badge></HStack></Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
              {draft.mode === 'svl' && <>
                <FormControl>
                  <FormLabel htmlFor="svl-level">レベル</FormLabel>
                  <Select id="svl-level" value={draft.level} onChange={(event) => setDraft((value) => ({ ...value, level: Number(event.target.value) }))}>
                    {SVL_LEVELS.map((level) => <option key={level} value={level}>{levelLabel(level)}</option>)}
                  </Select>
                </FormControl>
                <Text fontSize="sm" color="gray.600">試験提供中です。単語と意味だけで学習できます。初回の読み込みには通信が必要です。</Text>
              </>}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>キャンセル</Button>
            <Button colorScheme="teal" onClick={() => {
              saveStudySettings(draft)
              setSettings(draft)
              setIsOpen(false)
            }}>変更する</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
