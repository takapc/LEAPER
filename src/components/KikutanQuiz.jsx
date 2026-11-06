import { useState } from 'react'
import { Alert, AlertIcon, Box, Container, FormControl, FormLabel, Heading, Input, Text, VStack } from '@chakra-ui/react'
import App from '../App'
import { PART_OF_SPEECH_LABELS } from '../utils/meanings.js'
import { adaptKikutanData, createKikutanStore } from '../utils/kikutanData.js'

export function KikutanQuiz({ restoreOnly = false }) {
  const [store] = useState(() => createKikutanStore())
  const [error, setError] = useState('')
  const [data, setData] = useState(() => {
    try { return store.readData() } catch { return [] }
  })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const control = <VStack align="stretch" spacing={2} w="full">
    <FormControl>
      <FormLabel htmlFor="kikutan-file" fontSize="sm">キクタンSuperのJSONを追加</FormLabel>
      <Input id="kikutan-file" type="file" accept=".json,application/json" p={1} isDisabled={busy} onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setBusy(true)
        setError('')
        setNotice('')
        try {
          const merged = store.importData(JSON.parse(await file.text()))
          setData(merged)
          setRevision((value) => value + 1)
          setNotice(`${merged.length}語を保存しました。`)
        } catch (err) {
          setError(err.message || 'JSONを読み込めませんでした。')
        } finally { setBusy(false) }
      }} />
    </FormControl>
    <Text fontSize="xs" color="gray.600">データはこのブラウザー内に保存します。既存番号と異なるデータは上書きしません。元のJSONも保管してください。</Text>
    {error && <Alert status="error"><AlertIcon />{error}</Alert>}
    {notice && <Text role="status" fontSize="sm">{notice}</Text>}
  </VStack>
  if (!data.length) return <Box minH="100vh" py={{ base: 6, md: 10 }}>
    <Container maxW="container.md"><VStack spacing={6} align="stretch">
      <Heading size={{ base: 'lg', md: 'xl' }} pr={12}>キクタンSuper</Heading>
      <Text>学習するJSONを読み込んでください。</Text>
      {control}
    </VStack></Container>
  </Box>
  return <App key={revision} restoreOnly={restoreOnly || revision > 0}
    dataset={{ words: adaptKikutanData(data), services: store, partOfSpeechLabels: { ...Object.fromEntries(Object.entries(PART_OF_SPEECH_LABELS).filter(([key]) => key !== 'phrase')), pronoun: '代名詞', interjection: '感動詞', determiner: '限定詞', other: 'その他' } }} dataControl={control} />
}
